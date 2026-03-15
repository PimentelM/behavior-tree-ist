import WebSocket from "ws";
import type {
    TransportInterface,
    TransportData,
    TransportFactory,
} from "@bt-studio/core";

const textDecoder = new TextDecoder();

/**
 * WebSocket transport for Node.js that sends and receives string-only
 * data using the `ws` library.
 */
export class WsNodeStringTransport implements TransportInterface {
    private ws: WebSocket | null = null;

    constructor(private readonly url: string) { }

    /**
     * Creates a TransportFactory that produces WsNodeStringTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsNodeStringTransport(url);
    }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.url);
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
            throw new Error("WsNodeStringTransport: not connected");
        }
        const str =
            typeof data === "string"
                ? data
                : textDecoder.decode(data);
        this.ws.send(str);
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.ws) {
            throw new Error("WsNodeStringTransport: not connected");
        }

        const onMsg = (raw: WebSocket.RawData) => {
            if (typeof raw === "string") {
                handler(raw);
            } else if (Buffer.isBuffer(raw)) {
                handler(raw.toString("utf-8"));
            } else if (raw instanceof ArrayBuffer) {
                handler(new TextDecoder().decode(raw));
            } else if (Array.isArray(raw)) {
                handler(Buffer.concat(raw).toString("utf-8"));
            }
        };

        this.ws.on("message", onMsg);
        return () => {
            this.ws?.off("message", onMsg);
        };
    }

    onError(handler: (error: Error) => void) {
        if (!this.ws) {
            throw new Error("WsNodeStringTransport: not connected");
        }

        const onErr = (err: Error) => handler(err);
        this.ws.on("error", onErr);
        return () => {
            this.ws?.off("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error("WsNodeStringTransport: not connected");
        }

        this.ws.on("close", handler);
        return () => {
            this.ws?.off("close", handler);
        };
    }
}
