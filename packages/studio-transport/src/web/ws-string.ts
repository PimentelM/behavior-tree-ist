import type {
    TransportInterface,
    TransportData,
    TransportFactory,
} from "@bt-studio/core";

/**
 * Browser WebSocket transport that sends and receives string-only
 * data using the native WebSocket API.
 */
export class WsBrowserStringTransport implements TransportInterface {
    private ws: WebSocket | null = null;

    constructor(private readonly url: string) { }

    /**
     * Creates a TransportFactory that produces WsBrowserStringTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsBrowserStringTransport(url);
    }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(this.url);
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
        if (this.ws?.readyState !== WebSocket.OPEN) {
            throw new Error("WsBrowserStringTransport: not connected");
        }
        const str =
            typeof data === "string"
                ? data
                : new TextDecoder().decode(data);
        this.ws.send(str);
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.ws) {
            throw new Error("WsBrowserStringTransport: not connected");
        }

        const onMsg = (event: MessageEvent) => {
            if (typeof event.data === "string") {
                handler(event.data);
            } else if (event.data instanceof ArrayBuffer) {
                handler(new TextDecoder().decode(event.data));
            }
        };

        this.ws.addEventListener("message", onMsg);
        return () => {
            this.ws?.removeEventListener("message", onMsg);
        };
    }

    onError(handler: (error: Error) => void) {
        if (!this.ws) {
            throw new Error("WsBrowserStringTransport: not connected");
        }

        const onErr = () => { handler(new Error("WebSocket error")); };
        this.ws.addEventListener("error", onErr);
        return () => {
            this.ws?.removeEventListener("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.ws) {
            throw new Error("WsBrowserStringTransport: not connected");
        }

        this.ws.addEventListener("close", handler);
        return () => {
            this.ws?.removeEventListener("close", handler);
        };
    }
}
