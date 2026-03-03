import { WebSocketClientInterface } from '../../types/interfaces';
import { Server as HttpServer, IncomingMessage } from 'http';

export interface WebSocketServerConfigInterface {
    server: HttpServer;
    path: string;
    maxConnections: number;
}

export interface WebSocketServerInterface {
    start(config: WebSocketServerConfigInterface): Promise<void>;
    stop(): Promise<void>;
    broadcast(message: object): void;
    sendToClient(clientId: string, message: object): void;
    onConnection(handler: (client: WebSocketClientInterface, request: IncomingMessage) => void): void;
    onDisconnection(handler: (clientId: string) => void): void;
    getClient(clientId: string): WebSocketClientInterface | undefined;
    getClients(): Map<string, WebSocketClientInterface>;
    getClientCount(): number;
}
