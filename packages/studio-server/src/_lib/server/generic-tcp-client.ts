import type { Socket } from 'net';
import { FrameDecoder, encodeFrame } from '@bt-studio/studio-transport';
import { type Logger } from '../logger';
import { type Connection, type ConnectionSerializer } from '../connection';

export interface GenericTcpClientOptions<TReceive, TSend> {
    logger: Logger;
    serializer: ConnectionSerializer<TReceive, TSend>;
}

export class GenericTcpClient<TReceive, TSend> implements Connection<TReceive, TSend> {
    private readonly messageHandlers: Array<(message: TReceive) => void | Promise<void>> = [];
    private readonly disconnectHandlers: Array<() => void> = [];
    private readonly decoder: FrameDecoder;
    private messageQueue: Promise<void> = Promise.resolve();
    private readonly logger: Logger;
    private readonly serializer: ConnectionSerializer<TReceive, TSend>;
    readonly transport = 'tcp' as const;
    lastRawByteSize = 0;

    constructor(
        public readonly id: string,
        private readonly socket: Socket,
        options: GenericTcpClientOptions<TReceive, TSend>
    ) {
        this.logger = options.logger;
        this.serializer = options.serializer;

        this.decoder = new FrameDecoder((payload) => {
            this.messageQueue = this.messageQueue.then(async () => {
                await this.handleFrame(payload);
            });
        });

        this.socket.on('data', (chunk: Buffer) => {
            this.decoder.feed(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });

        this.socket.on('close', () => {
            this.disconnectHandlers.forEach((handler) => { handler(); });
        });

        this.socket.on('error', (error) => {
            this.logger.error('TCP socket error', { error: String(error) });
            this.disconnect();
        });
    }

    send(message: TSend): void {
        if (this.socket.destroyed || !this.socket.writable) {
            this.logger.warn('Cannot send message: TCP socket not writable');
            return;
        }

        try {
            const serialized = this.serializer.serialize(message);
            const payload = typeof serialized === 'string'
                ? new TextEncoder().encode(serialized)
                : serialized;

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

    onMessage(handler: (message: TReceive) => void | Promise<void>): void {
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
            this.lastRawByteSize = payload.byteLength;
            const parsed = this.serializer.deserialize(payload);

            if (parsed === undefined) {
                return; // Serializer is expected to log/handle invalid messages
            }

            for (const handler of this.messageHandlers) {
                await handler(parsed);
            }
        } catch (error) {
            this.logger.error('Error parsing or handling TCP message', { error: String(error) });
        }
    }
}
