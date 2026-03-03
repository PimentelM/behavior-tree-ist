import { WebSocketServer, WebSocket } from "ws";
import type { AddressInfo } from "net";
import type { TestServerHarness } from "./transport-test-suite";

/**
 * Creates a WebSocket echo server.
 * Every message received is echoed back in the same format (binary or string).
 */
export function createWsEchoServer(): TestServerHarness {
    let wss: WebSocketServer;

    return {
        async start(): Promise<number> {
            wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });

            wss.on("connection", (ws: WebSocket) => {
                ws.on("message", (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(data, { binary: isBinary });
                    }
                });
            });

            return new Promise<number>((resolve) => {
                wss.on("listening", () => {
                    const addr = wss.address() as AddressInfo;
                    resolve(addr.port);
                });
            });
        },

        async stop(): Promise<void> {
            for (const client of wss.clients) {
                client.close();
            }
            return new Promise<void>((resolve) => {
                wss.close(() => resolve());
            });
        },
    };
}
