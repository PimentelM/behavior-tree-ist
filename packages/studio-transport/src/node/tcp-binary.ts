import type { TransportData, TransportFactory } from "@bt-studio/core";
import { encodeFrame, FrameDecoder } from "../shared/length-framing";
import { TcpTransportBase } from "./tcp-base";

/**
 * TCP transport that sends and receives binary (Uint8Array) data
 * using length-based framing over a raw Node.js socket.
 */
export class TcpBinaryTransport extends TcpTransportBase {
    /**
     * Creates a TransportFactory that produces TcpBinaryTransport instances
     * pre-configured with the given host and port.
     */
    static createFactory(host: string, port: number): TransportFactory {
        return () => new TcpBinaryTransport(host, port);
    }

    send(data: TransportData): void {
        if (!this.socket) {
            throw new Error("TcpBinaryTransport: not connected");
        }
        const bytes =
            typeof data === "string"
                ? new TextEncoder().encode(data)
                : data;
        this.socket.write(encodeFrame(bytes));
    }

    onMessage(handler: (data: TransportData) => void) {
        if (!this.socket) {
            throw new Error("TcpBinaryTransport: not connected");
        }

        this.decoder = new FrameDecoder((payload) => handler(payload));

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
