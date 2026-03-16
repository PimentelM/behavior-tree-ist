import WebSocket from "ws";
import type {
    TransportInterface,
    TransportData,
} from "@bt-studio/core";

/**
 * Abstract base for Node.js WebSocket transports (ws library). Provides
 * shared connection lifecycle (open, close, onError, onClose). Subclasses
 * implement send() and onMessage(), and may pass a binaryType to configure
 * the WebSocket.
 */
export abstract class WsNodeTransportBase implements TransportInterface {
    protected ws: WebSocket | null = null;

    constructor(
        protected readonly url: string,
        private readonly binaryType?: "arraybuffer"
    ) { }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.url);
            if (this.binaryType !== undefined) {
                ws.binaryType = this.binaryType;
            }
            this.ws = ws;

            const onError = (err: Error) => {
                ws.off("error", onError);
                reject(err);
            };

            ws.once("error", onError);

            ws.once("open", () => {
                ws.off("error", onError);
                resolve();
            });
        });
    }

    close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    onError(handler: (error: Error) => void) {
        if (!this.ws) {
            throw new Error(`${this.constructor.name}: not connected`);
        }

        const onErr = (err: Error) => handler(err);
        this.ws.on("error", onErr);
        return () => {
            this.ws?.off("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error(`${this.constructor.name}: not connected`);
        }

        this.ws.on("close", handler);
        return () => {
            this.ws?.off("close", handler);
        };
    }

    abstract send(data: TransportData): void;
    abstract onMessage(handler: (data: TransportData) => void): () => void;
}
