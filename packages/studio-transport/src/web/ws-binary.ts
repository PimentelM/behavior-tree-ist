import type {
    TransportInterface,
    TransportData,
    TransportFactory,
} from "@behavior-tree-ist/core";

/**
 * Browser WebSocket transport that sends and receives binary
 * (Uint8Array) data using the native WebSocket API.
 */
export class WsBrowserBinaryTransport implements TransportInterface {
    private ws: WebSocket | null = null;

    constructor(private readonly url: string) { }

    /**
     * Creates a TransportFactory that produces WsBrowserBinaryTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsBrowserBinaryTransport(url);
    }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.url);
            ws.binaryType = "arraybuffer";
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

    send(data: TransportData): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error("WsBrowserBinaryTransport: not connected");
        }
        const bytes =
            typeof data === "string"
                ? new TextEncoder().encode(data)
                : data;
        this.ws.send(bytes);
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.ws) {
            throw new Error("WsBrowserBinaryTransport: not connected");
        }

        const onMsg = (event: MessageEvent) => {
            if (event.data instanceof ArrayBuffer) {
                handler(new Uint8Array(event.data));
            } else if (typeof event.data === "string") {
                handler(new TextEncoder().encode(event.data));
            }
        };

        this.ws.addEventListener("message", onMsg);
        return () => {
            this.ws?.removeEventListener("message", onMsg);
        };
    }

    onError(handler: (error: Error) => void) {
        if (!this.ws) {
            throw new Error("WsBrowserBinaryTransport: not connected");
        }

        const onErr = () => handler(new Error("WebSocket error"));
        this.ws.addEventListener("error", onErr);
        return () => {
            this.ws?.removeEventListener("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error("WsBrowserBinaryTransport: not connected");
        }

        this.ws.addEventListener("close", handler);
        return () => {
            this.ws?.removeEventListener("close", handler);
        };
    }
}
