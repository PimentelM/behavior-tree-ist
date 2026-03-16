import type { TransportData, TransportFactory } from "@bt-studio/core";
import { encodeStringFrame, FrameDecoder } from "../shared/length-framing";
import { TcpTransportBase } from "./tcp-base";

const textDecoder = new TextDecoder();

/**
 * TCP transport that sends and receives string-only data
 * using length-based framing over a raw Node.js socket.
 *
 * Strings are encoded as UTF-8 for framing. Incoming frames
 * are decoded back to strings before being emitted.
 */
export class TcpStringTransport extends TcpTransportBase {
    /**
     * Creates a TransportFactory that produces TcpStringTransport instances
     * pre-configured with the given host and port.
     */
    static createFactory(host: string, port: number): TransportFactory {
        return () => new TcpStringTransport(host, port);
    }

    send(data: TransportData): void {
        if (!this.socket) {
            throw new Error("TcpStringTransport: not connected");
        }
        const str = typeof data === "string" ? data : textDecoder.decode(data);
        this.socket.write(encodeStringFrame(str));
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.socket) {
            throw new Error("TcpStringTransport: not connected");
        }

        this.decoder = new FrameDecoder((payload) => {
            handler(textDecoder.decode(payload));
        });

        const onData = (chunk: Buffer) => {
            this.decoder?.feed(new Uint8Array(chunk));
        };

        this.socket.on("data", onData);

        return () => {
            this.socket?.off("data", onData);
            this.decoder?.reset();
            this.decoder = null;
        };
    }
}
