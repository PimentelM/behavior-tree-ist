import { Socket } from "net";
import type {
    TransportInterface,
    TransportData,
} from "@bt-studio/core";
import { type FrameDecoder } from "../shared/length-framing";

/**
 * Abstract base for TCP transports. Provides shared connection lifecycle
 * (open, close, onError, onClose) over a raw Node.js socket with
 * length-based framing. Subclasses implement send() and onMessage().
 */
export abstract class TcpTransportBase implements TransportInterface {
    protected socket: Socket | null = null;
    protected decoder: FrameDecoder | null = null;

    constructor(
        protected readonly host: string,
        protected readonly port: number
    ) { }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const socket = new Socket();
            this.socket = socket;

            const onError = (err: Error) => {
                socket.off("error", onError);
                this.socket = null;
                reject(err);
            };

            socket.once("error", onError);

            socket.connect(this.port, this.host, () => {
                socket.off("error", onError);
                resolve();
            });
        });
    }

    close(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        if (this.decoder) {
            this.decoder.reset();
            this.decoder = null;
        }
    }

    onError(handler: (error: Error) => void) {
        if (!this.socket) {
            throw new Error(`${this.constructor.name}: not connected`);
        }

        const onErr = (err: Error) => { handler(err); };
        this.socket.on("error", onErr);
        return () => {
            this.socket?.off("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.socket) {
            throw new Error(`${this.constructor.name}: not connected`);
        }

        this.socket.on("close", handler);
        return () => {
            this.socket?.off("close", handler);
        };
    }

    abstract send(data: TransportData): void;
    abstract onMessage(handler: (data: TransportData) => void): () => void;
}
