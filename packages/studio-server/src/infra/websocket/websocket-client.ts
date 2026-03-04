import WebSocket from 'ws';
import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageConnectionInterface } from '../../types/interfaces';
import { createLogger, Logger } from '../logging';
import { OutboundMessageSchema } from '../../domain/bt-core-types';

export class WSWebSocketClient implements MessageConnectionInterface {
    private readonly socket: WebSocket;
    private readonly messageHandlers: Array<(message: OutboundMessage) => void | Promise<void>> = [];
    private readonly disconnectHandlers: Array<() => void> = [];
    private messageQueue: Promise<void> = Promise.resolve();
    private readonly logger: Logger;
    private prefersBinary = false;
    readonly transport = 'websocket' as const;

    constructor(
        public readonly id: string,
        socket: WebSocket
    ) {
        this.logger = createLogger(`ws-client:${id.slice(0, 8)}`);
        this.socket = socket;

        this.socket.on('message', (data: WebSocket.Data, isBinary: boolean) => {
            if (isBinary) {
                this.prefersBinary = true;
            }

            this.messageQueue = this.messageQueue.then(async () => {
                try {
                    const rawText = this.toTextPayload(data);
                    const raw = JSON.parse(rawText) as unknown;
                    const parsed = OutboundMessageSchema.safeParse(raw);
                    if (!parsed.success) {
                        this.logger.warn('Dropping invalid outbound message', {
                            error: parsed.error.issues[0]?.message ?? 'Schema validation failed',
                        });
                        return;
                    }

                    const message = parsed.data as OutboundMessage;
                    for (const handler of this.messageHandlers) {
                        await handler(message);
                    }
                } catch (error) {
                    this.logger.error('Error parsing or handling client message', { error: String(error) });
                }
            });
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
            const payload = JSON.stringify(message);
            if (this.prefersBinary) {
                this.socket.send(new TextEncoder().encode(payload), { binary: true });
            } else {
                this.socket.send(payload);
            }
        } catch (error) {
            this.logger.error('Error sending message', { error: String(error) });
        }
    }

    disconnect(): void {
        if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
            this.socket.close();
        }
    }

    onMessage(handler: (message: OutboundMessage) => void | Promise<void>): void {
        this.messageHandlers.push(handler);
    }

    onDisconnect(handler: () => void): void {
        this.disconnectHandlers.push(handler);
    }

    isConnected(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }

    private toTextPayload(data: WebSocket.Data): string {
        if (typeof data === 'string') {
            return data;
        }

        if (Buffer.isBuffer(data)) {
            return data.toString('utf-8');
        }

        if (data instanceof ArrayBuffer) {
            return new TextDecoder().decode(data);
        }

        if (Array.isArray(data)) {
            return Buffer.concat(data).toString('utf-8');
        }

        throw new Error('Unsupported WebSocket message payload type');
    }
}
