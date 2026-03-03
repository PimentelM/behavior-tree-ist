import { WebSocketServer, type ServerOptions } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketServerInterface, WebSocketServerConfigInterface } from './interfaces';
import { WSWebSocketClient } from './websocket-client';
import { WebSocketClientInterface } from '../../types/interfaces';
import { IncomingMessage } from 'http';
import { Logger } from '../logging';

const TRY_AGAIN_LATER_CODE = 1008;

export class WSWebSocketServer implements WebSocketServerInterface {
    private server: WebSocketServer | null = null;
    private readonly clients: Map<string, WebSocketClientInterface> = new Map();
    private readonly connectionHandlers: Array<(client: WebSocketClientInterface, request: IncomingMessage) => void> = [];
    private readonly disconnectionHandlers: Array<(clientId: string) => void> = [];
    private config: WebSocketServerConfigInterface | null = null;
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async start(serverConfig: WebSocketServerConfigInterface): Promise<void> {
        if (this.server) {
            throw new Error('WebSocket server is already running');
        }

        this.config = serverConfig;

        return new Promise((resolve, reject) => {
            try {
                const options: ServerOptions = {
                    path: serverConfig.path,
                    server: serverConfig.server,
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
                    const client = new WSWebSocketClient(clientId, socket);
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

    broadcast(message: object): void {
        for (const client of this.clients.values()) {
            client.send(message);
        }
        this.logger.debug('Broadcast sent', { clientCount: this.clients.size });
    }

    sendToClient(clientId: string, message: object): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.send(message);
        } else {
            this.logger.warn('Send to non-existent client', { clientId });
        }
    }

    onConnection(handler: (client: WebSocketClientInterface, request: IncomingMessage) => void): void {
        this.connectionHandlers.push(handler);
    }

    onDisconnection(handler: (clientId: string) => void): void {
        this.disconnectionHandlers.push(handler);
    }

    getClient(clientId: string): WebSocketClientInterface | undefined {
        return this.clients.get(clientId);
    }

    getClients(): Map<string, WebSocketClientInterface> {
        return new Map(this.clients);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    private registerClient(clientId: string, client: WebSocketClientInterface, request: IncomingMessage): void {
        this.clients.set(clientId, client);
        this.logger.debug('Client connected', { clientId });

        client.onDisconnect(() => {
            this.clients.delete(clientId);
            this.logger.debug('Client disconnected', { clientId });
            this.disconnectionHandlers.forEach(handler => handler(clientId));
        });

        this.connectionHandlers.forEach(handler => handler(client, request));
    }
}

export function createWebSocketServer(logger: Logger): WebSocketServerInterface {
    return new WSWebSocketServer(logger);
}
