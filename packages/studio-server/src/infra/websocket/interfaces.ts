import type { MessageServerInterface } from '../../types/interfaces';
import { Server as HttpServer, IncomingMessage } from 'http';

export interface WebSocketServerConfigInterface {
    server: HttpServer;
    path: string;
    maxConnections: number;
}

export interface WebSocketConnectionContext {
    transport: 'websocket';
    request: IncomingMessage;
}

export type WebSocketServerInterface =
    MessageServerInterface<WebSocketServerConfigInterface, WebSocketConnectionContext>;
