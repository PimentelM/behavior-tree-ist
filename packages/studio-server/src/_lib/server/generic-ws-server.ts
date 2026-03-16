import { WebSocketServer, type ServerOptions } from 'ws';
import type WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { Connection, Server } from '../connection';
import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { Logger } from '../logger';

const TRY_AGAIN_LATER_CODE = 1008;

export interface GenericWebSocketServerConfig {
    maxConnections: number;
}

export interface GenericWebSocketConnectionContext {
    transport: 'websocket';
    request: IncomingMessage;
}

export interface WebSocketClientFactory<TReceive, TSend, TConnection extends Connection<TReceive, TSend> = Connection<TReceive, TSend>> {
    createClient(id: string, socket: WebSocket): TConnection;
}

export class GenericWebSocketServer<TReceive, TSend, TConnection extends Connection<TReceive, TSend> = Connection<TReceive, TSend>> implements Server<GenericWebSocketServerConfig, GenericWebSocketConnectionContext, TReceive, TSend, TConnection> {
    private server: WebSocketServer | null = null;
    private readonly clients: Map<string, TConnection> = new Map();
    private readonly connectionHandlers: Array<(client: TConnection, context: GenericWebSocketConnectionContext) => void> = [];
    private readonly disconnectionHandlers: Array<(clientId: string) => void> = [];
    private config: GenericWebSocketServerConfig | null = null;
    private readonly logger: Logger;

    constructor(
        logger: Logger,
        private readonly clientFactory: WebSocketClientFactory<TReceive, TSend, TConnection>
    ) {
        this.logger = logger;
    }

    async start(serverConfig: GenericWebSocketServerConfig): Promise<void> {
        if (this.server) {
            throw new Error('WebSocket server is already running');
        }

        this.config = serverConfig;

        return new Promise((resolve, reject) => {
            try {
                const options: ServerOptions = {
                    noServer: true,
                    maxPayload: 1024 * 1024,
                    verifyClient: (_, callback) => {
                        if (this.clients.size >= serverConfig.maxConnections) {
                            callback(false, TRY_AGAIN_LATER_CODE, 'Too many connections');
                            return;
                        }
                        callback(true);
                    },
                };

                this.server = new WebSocketServer(options);

                this.server.on('listening', () => {
                    this.logger.info('WebSocket server listening');
                });

                this.server.on('connection', (socket, request) => {
                    const clientId = uuidv4();
                    const client = this.clientFactory.createClient(clientId, socket);
                    this.registerClient(clientId, client, request);
                });

                this.server.on('error', (error) => {
                    this.logger.error('WebSocket server error', { error: String(error) });
                });

                this.logger.info('WebSocket server setup complete');
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        return new Promise((resolve, reject) => {
            for (const client of this.clients.values()) {
                client.disconnect();
            }
            this.clients.clear();

            this.server!.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.server = null;
                    this.config = null;
                    this.logger.info('WebSocket server stopped');
                    resolve();
                }
            });
        });
    }

    broadcast(message: TSend): void {
        for (const client of this.clients.values()) {
            client.send(message);
        }
        this.logger.debug('Broadcast sent', { clientCount: this.clients.size });
    }

    sendToClient(clientId: string, message: TSend): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.send(message);
        } else {
            this.logger.warn('Send to non-existent client', { clientId });
        }
    }

    onConnection(handler: (client: TConnection, context: GenericWebSocketConnectionContext) => void): void {
        this.connectionHandlers.push(handler);
    }

    onDisconnection(handler: (clientId: string) => void): void {
        this.disconnectionHandlers.push(handler);
    }

    getClient(clientId: string): TConnection | undefined {
        return this.clients.get(clientId);
    }

    getClients(): Map<string, TConnection> {
        return new Map(this.clients);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
        if (!this.server) {
            this.logger.warn('handleUpgrade called but server is not started');
            socket.destroy();
            return;
        }

        this.server.handleUpgrade(request, socket, head, (ws) => {
            this.server?.emit('connection', ws, request);
        });
    }

    private registerClient(clientId: string, client: TConnection, request: IncomingMessage): void {
        this.clients.set(clientId, client);
        this.logger.debug('Client connected', { clientId });

        client.onDisconnect(() => {
            this.clients.delete(clientId);
            this.logger.debug('Client disconnected', { clientId });
            this.disconnectionHandlers.forEach(handler => { handler(clientId); });
        });

        const context: GenericWebSocketConnectionContext = {
            transport: 'websocket',
            request,
        };
        this.connectionHandlers.forEach(handler => { handler(client, context); });
    }
}
