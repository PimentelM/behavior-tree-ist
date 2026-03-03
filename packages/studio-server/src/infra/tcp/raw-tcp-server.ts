import { createServer, Server as NetServer, Socket } from 'net';
import { v4 as uuidv4 } from 'uuid';
import type { MessageConnectionInterface } from '../../types/interfaces';
import type { Logger } from '../logging';
import type { RawTcpConnectionContext, RawTcpServerConfigInterface, RawTcpServerInterface } from './interfaces';
import { TCPSocketClient } from './tcp-socket-client';

export class RawTcpServer implements RawTcpServerInterface {
    private server: NetServer | null = null;
    private readonly clients = new Map<string, MessageConnectionInterface>();
    private readonly connectionHandlers: Array<(client: MessageConnectionInterface, context: RawTcpConnectionContext) => void> = [];
    private readonly disconnectionHandlers: Array<(clientId: string) => void> = [];
    private config: RawTcpServerConfigInterface | null = null;

    constructor(private readonly logger: Logger) {}

    async start(config: RawTcpServerConfigInterface): Promise<void> {
        if (this.server) {
            throw new Error('Raw TCP server is already running');
        }

        this.config = config;
        this.server = createServer((socket) => {
            if (this.clients.size >= config.maxConnections) {
                this.logger.warn('Rejecting TCP connection: too many connections');
                socket.destroy();
                return;
            }

            const clientId = uuidv4();
            const client = new TCPSocketClient(clientId, socket);
            this.registerClient(clientId, client, socket);
        });

        this.server.on('error', (error) => {
            this.logger.error('Raw TCP server error', { error: String(error) });
        });

        await new Promise<void>((resolve, reject) => {
            if (!this.server) {
                reject(new Error('Raw TCP server was not initialized'));
                return;
            }

            const onListenError = (error: Error) => {
                this.server?.off('listening', onListening);
                reject(error);
            };
            const onListening = () => {
                this.server?.off('error', onListenError);
                resolve();
            };

            this.server.once('error', onListenError);
            this.server.once('listening', onListening);
            this.server.listen(config.port, config.host);
        });

        this.logger.info('Raw TCP server listening', { host: config.host, port: config.port });
    }

    async stop(): Promise<void> {
        if (!this.server) {
            return;
        }

        for (const client of this.clients.values()) {
            client.disconnect();
        }
        this.clients.clear();

        const server = this.server;
        this.server = null;

        if (!server.listening) {
            this.config = null;
            return;
        }

        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        this.config = null;
        this.logger.info('Raw TCP server stopped');
    }

    broadcast(message: object): void {
        for (const client of this.clients.values()) {
            client.send(message);
        }
        this.logger.debug('Raw TCP broadcast sent', { clientCount: this.clients.size });
    }

    sendToClient(clientId: string, message: object): void {
        const client = this.clients.get(clientId);
        if (!client) {
            this.logger.warn('Send to non-existent raw TCP client', { clientId });
            return;
        }
        client.send(message);
    }

    onConnection(handler: (client: MessageConnectionInterface, context: RawTcpConnectionContext) => void): void {
        this.connectionHandlers.push(handler);
    }

    onDisconnection(handler: (clientId: string) => void): void {
        this.disconnectionHandlers.push(handler);
    }

    getClient(clientId: string): MessageConnectionInterface | undefined {
        return this.clients.get(clientId);
    }

    getClients(): Map<string, MessageConnectionInterface> {
        return new Map(this.clients);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    private registerClient(clientId: string, client: MessageConnectionInterface, socket: Socket): void {
        this.clients.set(clientId, client);
        this.logger.debug('Raw TCP client connected', { clientId });

        client.onDisconnect(() => {
            this.clients.delete(clientId);
            this.logger.debug('Raw TCP client disconnected', { clientId });
            this.disconnectionHandlers.forEach((handler) => handler(clientId));
        });

        const context: RawTcpConnectionContext = {
            transport: 'tcp',
            remoteAddress: socket.remoteAddress,
            remotePort: socket.remotePort,
        };
        this.connectionHandlers.forEach((handler) => handler(client, context));
    }
}

export function createRawTcpServer(logger: Logger): RawTcpServerInterface {
    return new RawTcpServer(logger);
}
