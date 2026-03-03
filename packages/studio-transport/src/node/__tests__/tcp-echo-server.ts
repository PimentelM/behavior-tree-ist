import * as net from "net";
import { encodeFrame, FrameDecoder } from "../../shared/length-framing";
import type { TestServerHarness } from "./transport-test-suite";

/**
 * Creates a TCP echo server that speaks the length-framing protocol.
 * Every complete frame received is echoed back as-is.
 */
export function createTcpEchoServer(): TestServerHarness {
    let server: net.Server;
    const sockets: net.Socket[] = [];

    return {
        async start(): Promise<number> {
            server = net.createServer((socket) => {
                sockets.push(socket);
                const decoder = new FrameDecoder((payload) => {
                    if (!socket.destroyed) {
                        socket.write(encodeFrame(payload));
                    }
                });
                socket.on("data", (chunk: Buffer) => {
                    decoder.feed(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                });
                socket.on("close", () => {
                    const idx = sockets.indexOf(socket);
                    if (idx >= 0) sockets.splice(idx, 1);
                });
            });

            return new Promise<number>((resolve) => {
                server.listen(0, "127.0.0.1", () => {
                    const addr = server.address() as net.AddressInfo;
                    resolve(addr.port);
                });
            });
        },

        async stop(): Promise<void> {
            for (const s of sockets) {
                s.destroy();
            }
            sockets.length = 0;
            return new Promise<void>((resolve) => {
                server.close(() => resolve());
            });
        },
    };
}
