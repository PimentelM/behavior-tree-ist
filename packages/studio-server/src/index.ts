import { createExpressApp } from './infra/express/express-setup';
import { createWebSocketServer } from './infra/websocket/websocket-server';
import { createKnexFromConfig } from './infra/knex/knex-factory';
import { MessageRouter } from './infra/message-router';
import { createLogger } from './infra/logging';
import { AgentConnectionRegistry } from './domain/services/agent-connection-registry';
import { CommandBroker } from './domain/services/command-broker';
import { ClientRepository } from './infra/knex/client-repository';
import { SessionRepository } from './infra/knex/session-repository';
import { TreeRepository } from './infra/knex/tree-repository';
import { TickRepository } from './infra/knex/tick-repository';
import { SettingsRepository } from './infra/knex/settings-repository';
import { registerWsHandlers, createDisconnectHandler } from './app/handlers/websocket';
import { createAppRouter } from './app/trpc';
import { makeConfig, StudioServerConfig } from './configuration';
import { AppDependencies } from './types/app-dependencies';
import * as trpcExpress from '@trpc/server/adapters/express';
import type { Server } from 'http';

export interface StudioServerOptions {
    httpHost?: string;
    httpPort?: number;
    wsPath?: string;
    sqlitePath?: string;
    commandTimeoutMs?: number;
    maxTicksPerTree?: number;
}

export interface StudioServerHandle {
    start(): Promise<void>;
    stop(): Promise<void>;
}

function optionsToConfig(options?: StudioServerOptions): StudioServerConfig {
    return {
        http: {
            port: options?.httpPort ?? 4100,
            host: options?.httpHost ?? '0.0.0.0',
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
    };
}

export function createStudioServer(options?: StudioServerOptions): StudioServerHandle {
    const config = optionsToConfig(options);
    let httpServer: Server | undefined;
    let deps: AppDependencies | undefined;

    return {
        async start() {
            const result = await initializeService({ config });
            httpServer = result.httpServer;
            deps = result.deps;
        },
        async stop() {
            if (!deps || !httpServer) return;
            const logger = createLogger('shutdown');
            logger.info('Shutting down');

            try {
                await deps.wsServer.stop();
            } catch (e) {
                createLogger('shutdown').warn('Error stopping WS server', { error: String(e) });
            }

            await new Promise<void>((resolve) => {
                httpServer!.close(() => resolve());
            });

            await deps.knex.destroy();
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

    // Infrastructure clients
    const knex = createKnexFromConfig(config);
    setupLogger.info('Running migrations');
    await knex.migrate.latest();

    // Infrastructure services
    const wsServer = createWebSocketServer(createLogger('ws-server'));
    const messageRouter = new MessageRouter();

    // Domain services
    const agentConnectionRegistry = new AgentConnectionRegistry();
    const commandBroker = new CommandBroker(wsServer, config.commandTimeoutMs);

    // Repositories
    const clientRepository = new ClientRepository(knex);
    const sessionRepository = new SessionRepository(knex);
    const treeRepository = new TreeRepository(knex);
    const tickRepository = new TickRepository(knex);
    const settingsRepository = new SettingsRepository(knex);

    const deps: AppDependencies = {
        knex,
        wsServer,
        messageRouter,
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

    // WebSocket handlers
    registerWsHandlers(deps);

    const disconnectHandler = createDisconnectHandler({ agentConnectionRegistry });

    wsServer.onConnection((client) => {
        client.onMessage((message) => {
            messageRouter.route(message.t, message, client);
        });
    });

    wsServer.onDisconnection((wsClientId) => {
        disconnectHandler(wsClientId);
    });

    // Start listening
    const httpServer = app.listen(config.http.port, config.http.host, () => {
        setupLogger.info(`HTTP server listening on ${config.http.host}:${config.http.port}`);
    });

    await wsServer.start({
        server: httpServer,
        path: config.ws.path,
        maxConnections: 1000,
    });

    setupLogger.info('Studio server initialized');
    return { httpServer, deps };
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

export type { AppRouter } from './app/trpc';
export type { StudioServerConfig } from './configuration';
