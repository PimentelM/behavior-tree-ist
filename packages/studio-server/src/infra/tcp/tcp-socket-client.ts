import type { Socket } from 'net';
import type { OutboundMessage } from '@behavior-tree-ist/core';
import { encodeFrame, FrameDecoder } from '@behavior-tree-ist/studio-transport';
import { OutboundMessageSchema } from '../../domain/bt-core-types';
import { createLogger, Logger } from '../logging';
import type { MessageConnectionInterface } from '../../types/interfaces';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class TCPSocketClient implements MessageConnectionInterface {
    private readonly messageHandlers: Array<(message: OutboundMessage) => void | Promise<void>> = [];
    private readonly disconnectHandlers: Array<() => void> = [];
    private readonly decoder: FrameDecoder;
    private messageQueue: Promise<void> = Promise.resolve();
    private readonly logger: Logger;
    readonly transport = 'tcp' as const;

    constructor(
        public readonly id: string,
        private readonly socket: Socket,
    ) {
        this.logger = createLogger(`tcp-client:${id.slice(0, 8)}`);
        this.decoder = new FrameDecoder((payload) => {
            this.messageQueue = this.messageQueue.then(async () => {
                await this.handleFrame(payload);
            });
        });

        this.socket.on('data', (chunk: Buffer) => {
            this.decoder.feed(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });

        this.socket.on('close', () => {
            this.disconnectHandlers.forEach((handler) => handler());
        });

        this.socket.on('error', (error) => {
            this.logger.error('TCP socket error', { error: String(error) });
            this.disconnect();
        });
    }

    send(message: object): void {
        if (this.socket.destroyed || !this.socket.writable) {
            this.logger.warn('Cannot send message: TCP socket not writable');
            return;
        }

        try {
            const payload = textEncoder.encode(JSON.stringify(message));
            const frame = encodeFrame(payload);
            this.socket.write(frame);
        } catch (error) {
            this.logger.error('Error sending TCP message', { error: String(error) });
        }
    }

    disconnect(): void {
        if (!this.socket.destroyed) {
            this.socket.destroy();
        }
    }

    onMessage(handler: (message: OutboundMessage) => void | Promise<void>): void {
        this.messageHandlers.push(handler);
    }

    onDisconnect(handler: () => void): void {
        this.disconnectHandlers.push(handler);
    }

    isConnected(): boolean {
        return !this.socket.destroyed && this.socket.writable;
    }

    private async handleFrame(payload: Uint8Array): Promise<void> {
        try {
            const rawText = textDecoder.decode(payload);
            const raw = JSON.parse(rawText) as unknown;
            const parsed = OutboundMessageSchema.safeParse(raw);

            if (!parsed.success) {
                this.logger.warn('Dropping invalid outbound TCP message', {
                    error: parsed.error.issues[0]?.message ?? 'Schema validation failed',
                });
                return;
            }

            for (const handler of this.messageHandlers) {
                await handler(parsed.data as OutboundMessage);
            }
        } catch (error) {
            this.logger.error('Error parsing or handling TCP message', { error: String(error) });
        }
    }
}
