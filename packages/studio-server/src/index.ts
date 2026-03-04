import { createExpressApp } from './infra/express/express-setup';
import { createWebSocketServer } from './infra/websocket/websocket-server';
import { createRawTcpServer } from './infra/tcp/raw-tcp-server';
import { createKnexFromConfig } from './infra/knex/knex-factory';
import { MessageRouter } from './infra/message-router';
import { EventDispatcher } from './infra/events/event-dispatcher';
import { createLogger } from './infra/logging';
import { AgentConnectionRegistry } from './app/services/agent-connection-registry';
import { CommandBroker } from './app/services/command-broker';
import { ClientRepository } from './infra/knex/client-repository';
import { SessionRepository } from './infra/knex/session-repository';
import { TreeRepository } from './infra/knex/tree-repository';
import { TickRepository } from './infra/knex/tick-repository';
import { SettingsRepository } from './infra/knex/settings-repository';
import { registerMessageHandlers, createDisconnectHandler } from './app/handlers/messages';
import { createAppRouter } from './app/handlers/trpc';
import { makeConfig, StudioServerConfig } from './configuration';
import { parseStudioServerConfig } from './configuration-schema';
import { AppDependencies } from './types/app-dependencies';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Server } from 'http';
import type { NextFunction, Request, Response } from 'express';
import type { Knex } from 'knex';
import type { WebSocketServerInterface } from './infra/websocket/interfaces';
import type { RawTcpServerInterface } from './infra/tcp/interfaces';
import type { CommandBrokerInterface } from './app/interfaces';

export interface StudioServerOptions {
    httpHost?: string;
    httpPort?: number;
    tcpHost?: string;
    tcpPort?: number;
    wsPath?: string;
    sqlitePath?: string;
    commandTimeoutMs?: number;
    maxTicksPerTree?: number;
    runMigrationsOnStartup?: boolean;
}

export interface StudioServerHandle {
    start(): Promise<void>;
    stop(): Promise<void>;
}

function optionsToConfig(options?: StudioServerOptions): StudioServerConfig {
    const httpHost = options?.httpHost ?? '0.0.0.0';

    return parseStudioServerConfig({
        http: {
            port: options?.httpPort ?? 4100,
            host: httpHost,
        },
        tcp: {
            port: options?.tcpPort ?? 4101,
            host: options?.tcpHost ?? httpHost,
        },
        ws: {
            path: options?.wsPath ?? '/ws',
        },
        sqlite: {
            path: options?.sqlitePath ?? ':memory:',
        },
        commandTimeoutMs: options?.commandTimeoutMs ?? 5000,
        maxTicksPerTree: options?.maxTicksPerTree ?? 1000,
        logLevel: 'info',
        migrations: {
            runOnStartup: options?.runMigrationsOnStartup ?? true,
        },
    });
}

async function closeHttpServer(httpServer: Server): Promise<void> {
    await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
    });
}

async function cleanupInitializedResources(params: {
    logger: ReturnType<typeof createLogger>;
    commandBroker?: CommandBrokerInterface;
    wsServer?: WebSocketServerInterface;
    tcpServer?: RawTcpServerInterface;
    httpServer?: Server;
    knex?: Knex;
}): Promise<void> {
    params.commandBroker?.shutdown();

    if (params.wsServer) {
        try {
            await params.wsServer.stop();
        } catch (error) {
            params.logger.warn('Error stopping WebSocket server during cleanup', { error: String(error) });
        }
    }

    if (params.tcpServer) {
        try {
            await params.tcpServer.stop();
        } catch (error) {
            params.logger.warn('Error stopping raw TCP server during cleanup', { error: String(error) });
        }
    }

    if (params.httpServer) {
        try {
            await closeHttpServer(params.httpServer);
        } catch (error) {
            params.logger.warn('Error closing HTTP server during cleanup', { error: String(error) });
        }
    }

    if (params.knex) {
        try {
            await params.knex.destroy();
        } catch (error) {
            params.logger.warn('Error destroying database client during cleanup', { error: String(error) });
        }
    }
}

export function createStudioServer(options?: StudioServerOptions): StudioServerHandle {
    const config = optionsToConfig(options);
    let httpServer: Server | undefined;
    let deps: AppDependencies | undefined;

    return {
        async start() {
            if (httpServer || deps) {
                throw new Error('Studio server is already running');
            }
            const result = await initializeService({ config });
            httpServer = result.httpServer;
            deps = result.deps;
        },
        async stop() {
            if (!deps || !httpServer) return;
            const logger = createLogger('shutdown');
            logger.info('Shutting down');

            await cleanupInitializedResources({
                logger,
                commandBroker: deps.commandBroker,
                wsServer: deps.wsServer,
                tcpServer: deps.tcpServer,
                httpServer,
                knex: deps.knex,
            });

            deps = undefined;
            httpServer = undefined;
            logger.info('Shutdown complete');
        },
    };
}

interface InitResult {
    httpServer: Server;
    deps: AppDependencies;
}

async function initializeService({ config }: { config: StudioServerConfig }): Promise<InitResult> {
    const setupLogger = createLogger('setup');
    setupLogger.info('Starting studio server');

    let knex: Knex | undefined;
    let wsServer: WebSocketServerInterface | undefined;
    let tcpServer: RawTcpServerInterface | undefined;
    let httpServer: Server | undefined;
    let commandBroker: CommandBroker | undefined;

    try {
        // Infrastructure clients
        knex = createKnexFromConfig(config);
        if (config.migrations.runOnStartup) {
            setupLogger.info('Running migrations');
            await knex.migrate.latest();
        } else {
            setupLogger.info('Skipping migrations');
        }

        // Infrastructure services
        wsServer = createWebSocketServer(createLogger('ws-server'));
        tcpServer = createRawTcpServer(createLogger('tcp-server'));
        const messageRouter = new MessageRouter();
        const eventDispatcher = new EventDispatcher(null, createLogger('domain-events'));

        // App services
        const agentConnectionRegistry = new AgentConnectionRegistry();
        commandBroker = new CommandBroker(
            {
                sendToClient: (clientId, message) => {
                    if (wsServer?.getClient(clientId)) {
                        wsServer.sendToClient(clientId, message);
                        return;
                    }

                    if (tcpServer?.getClient(clientId)) {
                        tcpServer.sendToClient(clientId, message);
                        return;
                    }

                    setupLogger.warn('Attempted to send command to unknown client', { clientId });
                },
            },
            config.commandTimeoutMs,
        );

        // Repositories
        const clientRepository = new ClientRepository(knex);
        const sessionRepository = new SessionRepository(knex);
        const treeRepository = new TreeRepository(knex);
        const tickRepository = new TickRepository(knex);
        const settingsRepository = new SettingsRepository(knex);

        const deps: AppDependencies = {
            knex,
            wsServer,
            tcpServer,
            messageRouter,
            eventDispatcher,
            agentConnectionRegistry,
            commandBroker,
            clientRepository,
            sessionRepository,
            treeRepository,
            tickRepository,
            settingsRepository,
            config,
        };

        // Express + tRPC
        const app = createExpressApp();
        const appRouter = createAppRouter(deps);

        app.use(
            '/trpc',
            trpcExpress.createExpressMiddleware({
                router: appRouter,
                createContext: () => deps,
            })
        );

        app.get('/', (_req, res) => res.status(200).send('ok'));
        app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

        registerMessageHandlers(deps);

        app.use((req, res) => {
            res.status(404).json({
                error: 'not_found',
                path: req.originalUrl || req.url,
            });
        });

        app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
            const status = typeof err === 'object' && err !== null && 'status' in err && typeof (err as { status?: unknown }).status === 'number'
                ? (err as { status: number }).status
                : 500;
            const isProd = process.env.NODE_ENV === 'production';
            const message = isProd
                ? 'internal_server_error'
                : (err instanceof Error ? err.message : 'Unknown error');

            if (status >= 500) {
                setupLogger.error('Unhandled request error', { error: String(err) });
            } else {
                setupLogger.warn('Handled request error', { status, error: String(err) });
            }

            res.status(status).json({ error: message });
        });

        const disconnectHandler = createDisconnectHandler({ agentConnectionRegistry, eventDispatcher });

        wsServer.onConnection((client) => {
            client.onMessage((message) => messageRouter.route(message.t, message, client));
        });

        wsServer.onDisconnection((clientId) => {
            disconnectHandler(clientId);
        });

        tcpServer.onConnection((client) => {
            client.onMessage((message) => messageRouter.route(message.t, message, client));
        });

        tcpServer.onDisconnection((clientId) => {
            disconnectHandler(clientId);
        });

        httpServer = await new Promise<Server>((resolve, reject) => {
            const server = app.listen(config.http.port, config.http.host);
            server.once('listening', () => resolve(server));
            server.once('error', reject);
        });
        setupLogger.info(`HTTP server listening on ${config.http.host}:${config.http.port}`);

        await wsServer.start({
            server: httpServer,
            path: config.ws.path,
            maxConnections: 1000,
        });
        await tcpServer.start({
            host: config.tcp.host,
            port: config.tcp.port,
            maxConnections: 1000,
        });

        setupLogger.info('Studio server initialized');
        return { httpServer, deps };
    } catch (error) {
        setupLogger.error('Studio server initialization failed', { error: String(error), stack: error instanceof Error && error?.stack });
        await cleanupInitializedResources({
            logger: setupLogger,
            commandBroker,
            wsServer,
            tcpServer,
            httpServer,
            knex,
        });
        throw error;
    }
}

async function main() {
    const config = makeConfig();
    await initializeService({ config });
}

// Allow running directly
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule) {
    main().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

export type { AppRouter } from './app/handlers/trpc';
export type { StudioServerConfig } from './configuration';
