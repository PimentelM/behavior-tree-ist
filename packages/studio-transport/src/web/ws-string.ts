import type { TransportData, TransportFactory } from "@bt-studio/core";
import { WsBrowserTransportBase } from "./ws-base";

/**
 * Browser WebSocket transport that sends and receives string-only
 * data using the native WebSocket API.
 */
export class WsBrowserStringTransport extends WsBrowserTransportBase {
    /**
     * Creates a TransportFactory that produces WsBrowserStringTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsBrowserStringTransport(url);
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
