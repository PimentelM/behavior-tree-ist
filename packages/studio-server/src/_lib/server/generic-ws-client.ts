import WebSocket from 'ws';
import { type Logger } from '../logger';
import { type Connection, type ConnectionSerializer } from '../connection';

export interface GenericWebSocketClientOptions<TReceive, TSend> {
    logger: Logger;
    serializer: ConnectionSerializer<TReceive, TSend>;
}

export class GenericWebSocketClient<TReceive, TSend> implements Connection<TReceive, TSend> {
    private readonly socket: WebSocket;
    private readonly messageHandlers: Array<(message: TReceive) => void | Promise<void>> = [];
    private readonly disconnectHandlers: Array<() => void> = [];
    private messageQueue: Promise<void> = Promise.resolve();
    private readonly logger: Logger;
    private readonly serializer: ConnectionSerializer<TReceive, TSend>;
    private prefersBinary = false;
    readonly transport = 'websocket' as const;
    lastRawByteSize = 0;

    constructor(
        public readonly id: string,
        socket: WebSocket,
        options: GenericWebSocketClientOptions<TReceive, TSend>
    ) {
        this.logger = options.logger;
        this.serializer = options.serializer;
        this.socket = socket;

        this.socket.on('message', (data: WebSocket.Data, isBinary: boolean) => {
            if (isBinary) {
                this.prefersBinary = true;
            }

            this.messageQueue = this.messageQueue.then(async () => {
                try {
                    const rawPayload = this.toRawPayload(data);
                    this.lastRawByteSize = typeof rawPayload === 'string'
                        ? Buffer.byteLength(rawPayload, 'utf8')
                        : rawPayload.byteLength;
                    const parsed = this.serializer.deserialize(rawPayload);

                    if (parsed === undefined) {
                        return; // Serializer is expected to log/handle invalid messages
                    }

                    for (const handler of this.messageHandlers) {
                        await handler(parsed);
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

    send(message: TSend): void {
        if (this.socket.readyState !== WebSocket.OPEN) {
            this.logger.warn('Cannot send message: connection not open');
            return;
        }

        try {
            const serialized = this.serializer.serialize(message);

            if (this.prefersBinary) {
                const payload = typeof serialized === 'string'
                    ? new TextEncoder().encode(serialized)
                    : serialized;
                this.socket.send(payload, { binary: true });
            } else {
                const payload = typeof serialized === 'string'
                    ? serialized
                    : new TextDecoder().decode(serialized);
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

    onMessage(handler: (message: TReceive) => void | Promise<void>): void {
        this.messageHandlers.push(handler);
    }

    onDisconnect(handler: () => void): void {
        this.disconnectHandlers.push(handler);
    }

    isConnected(): boolean {
        return this.socket.readyState === WebSocket.OPEN;
    }

    private toRawPayload(data: WebSocket.Data): string | Uint8Array {
        if (typeof data === 'string') {
            return data;
        }

        if (Buffer.isBuffer(data)) {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }

        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }

        if (Array.isArray(data)) {
            const buffer = Buffer.concat(data);
            return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        }

        throw new Error('Unsupported WebSocket message payload type');
    }
}
