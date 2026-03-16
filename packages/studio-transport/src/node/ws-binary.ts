import WebSocket from "ws";
import type { TransportData, TransportFactory } from "@bt-studio/core";
import { WsNodeTransportBase } from "./ws-base";

/**
 * WebSocket transport for Node.js that sends and receives binary
 * (Uint8Array) data using the `ws` library.
 */
export class WsNodeBinaryTransport extends WsNodeTransportBase {
    constructor(url: string) {
        super(url, "arraybuffer");
    }

    /**
     * Creates a TransportFactory that produces WsNodeBinaryTransport instances
     * pre-configured with the given WebSocket URL.
     */
    static createFactory(url: string): TransportFactory {
        return () => new WsNodeBinaryTransport(url);
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
}
