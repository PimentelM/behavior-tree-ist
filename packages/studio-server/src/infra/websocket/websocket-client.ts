import WebSocket from 'ws';
import { OutboundMessage } from '@behavior-tree-ist/core';
import { WebSocketClientInterface } from '../../types/interfaces';
import { createLogger, Logger } from '../logging';

export class WSWebSocketClient implements WebSocketClientInterface {
    private socket: WebSocket;
    private messageHandlers: Array<(message: OutboundMessage) => void> = [];
    private disconnectHandlers: Array<() => void> = [];
    private logger: Logger;

    constructor(
        public readonly id: string,
        socket: WebSocket
    ) {
        this.logger = createLogger(`ws-client:${id.slice(0, 8)}`);
        this.socket = socket;

        this.socket.on('message', (data: WebSocket.Data) => {
            try {
                const message = JSON.parse(data.toString()) as OutboundMessage;
                this.messageHandlers.forEach(handler => handler(message));
            } catch (_error) {
                this.logger.error('Error parsing client message', { raw: data.toString() });
            }
        });

        this.socket.on('close', () => {
            this.disconnectHandlers.forEach(handler => handler());
        });

        this.socket.on('error', (error) => {
            this.logger.error('WebSocket error', { error: String(error) });
            this.disconnect();
        });
    }

    send(message: object): void {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.logger.warn('Cannot send message: connection not open');
            return;
        }

        try {
            this.socket.send(JSON.stringify(message));
        } catch (error) {
            this.logger.error('Error sending message', { error: String(error) });
        }
    }

    disconnect(): void {
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
            this.socket.close();
        }
    }

    onMessage(handler: (message: OutboundMessage) => void): void {
        this.messageHandlers.push(handler);
    }

    onDisconnect(handler: () => void): void {
        this.disconnectHandlers.push(handler);
    }

    isConnected(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }
}
