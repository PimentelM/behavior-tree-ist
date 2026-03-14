import WebSocket from "ws";
import type {
    TransportInterface,
    TransportData,
    TransportFactory,
} from "@bt-studio/core";

/**
 * WebSocket transport for Node.js that sends and receives binary
 * (Uint8Array) data using the `ws` library.
 */
export class WsNodeBinaryTransport implements TransportInterface {
    private ws: WebSocket | null = null;

    constructor(private readonly url: string) { }

    /**
     * Creates a TransportFactory that produces WsNodeBinaryTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsNodeBinaryTransport(url);
    }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.url);
            ws.binaryType = "arraybuffer";
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

    send(data: TransportData): void {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error("WsNodeBinaryTransport: not connected");
        }
        const bytes =
            typeof data === "string"
                ? new TextEncoder().encode(data)
                : data;
        this.ws.send(bytes);
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.ws) {
            throw new Error("WsNodeBinaryTransport: not connected");
        }

        const onMsg = (raw: WebSocket.RawData) => {
            if (raw instanceof ArrayBuffer) {
                handler(new Uint8Array(raw));
            } else if (Buffer.isBuffer(raw)) {
                handler(new Uint8Array(raw));
            } else if (Array.isArray(raw)) {
                handler(new Uint8Array(Buffer.concat(raw)));
            } else {
                handler(new Uint8Array(raw));
            }
        };

        this.ws.on("message", onMsg);
        return () => {
            this.ws?.off("message", onMsg);
        };
    }

    onError(handler: (error: Error) => void) {
        if (!this.ws) {
            throw new Error("WsNodeBinaryTransport: not connected");
        }

        const onErr = (err: Error) => handler(err);
        this.ws.on("error", onErr);
        return () => {
            this.ws?.off("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error("WsNodeBinaryTransport: not connected");
        }

        this.ws.on("close", handler);
        return () => {
            this.ws?.off("close", handler);
        };
    }
}
