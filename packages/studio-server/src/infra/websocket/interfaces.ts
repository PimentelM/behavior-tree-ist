import type { MessageServerInterface } from '../../types/interfaces';
import { type IncomingMessage } from 'http';
import type { Duplex } from 'stream';

export interface WebSocketServerConfigInterface {
    maxConnections: number;
}

export interface WebSocketConnectionContext {
    transport: 'websocket';
    request: IncomingMessage;
}

export interface WebSocketServerInterface extends MessageServerInterface<WebSocketServerConfigInterface, WebSocketConnectionContext> {
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void;
}
