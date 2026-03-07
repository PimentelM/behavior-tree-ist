import { Socket } from "net";
import type {
    TransportInterface,
    TransportData,
    TransportFactory,
} from "@bt-studio/core";
import { encodeFrame, FrameDecoder } from "../shared/length-framing";

/**
 * TCP transport that sends and receives binary (Uint8Array) data
 * using length-based framing over a raw Node.js socket.
 */
export class TcpBinaryTransport implements TransportInterface {
    private socket: Socket | null = null;
    private decoder: FrameDecoder | null = null;

    constructor(
        private readonly host: string,
        private readonly port: number
    ) { }

    /**
     * Creates a TransportFactory that produces TcpBinaryTransport instances
     * pre-configured with the given host and port.
     */
    static createFactory(host: string, port: number): TransportFactory {
        return () => new TcpBinaryTransport(host, port);
    }

    open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const socket = new Socket();
            this.socket = socket;

            const onError = (err: Error) => {
                socket.off("error", onError);
                reject(err);
            };

            socket.once("error", onError);

            socket.connect(this.port, this.host, () => {
                socket.off("error", onError);
                resolve();
            });
        });
    }

    close(): void {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }
        if (this.decoder) {
            this.decoder.reset();
            this.decoder = null;
        }
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

    onError(handler: (error: Error) => void) {
        if (!this.socket) {
            throw new Error("TcpBinaryTransport: not connected");
        }

        const onErr = (err: Error) => handler(err);
        this.socket.on("error", onErr);
        return () => {
            this.socket?.off("error", onErr);
        };
    }

    onClose(handler: () => void) {
        if (!this.socket) {
            throw new Error("TcpBinaryTransport: not connected");
        }

        this.socket.on("close", handler);
        return () => {
            this.socket?.off("close", handler);
        };
    }
}
