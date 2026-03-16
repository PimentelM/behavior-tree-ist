import type {
    TransportInterface,
    TransportData,
} from "@bt-studio/core";

/**
 * Abstract base for browser WebSocket transports (native WebSocket API).
 * Provides shared connection lifecycle (open, close, onError, onClose).
 * Subclasses implement send() and onMessage(), and may pass a binaryType
 * to configure the WebSocket.
 */
export abstract class WsBrowserTransportBase implements TransportInterface {
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

            ws.onopen = () => {
                ws.onopen = null;
                ws.onerror = null;
                resolve();
            };

            ws.onerror = () => {
                ws.onopen = null;
                ws.onerror = null;
                reject(new Error(`WebSocket connection failed: ${this.url}`));
            };
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

        const onErr = () => handler(new Error("WebSocket error"));
        this.ws.addEventListener("error", onErr);
        return () => {
            this.ws?.removeEventListener("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error(`${this.constructor.name}: not connected`);
        }

        this.ws.addEventListener("close", handler);
        return () => {
            this.ws?.removeEventListener("close", handler);
        };
    }

    abstract send(data: TransportData): void;
    abstract onMessage(handler: (data: TransportData) => void): () => void;
}
