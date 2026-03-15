import { describe, it, expect } from "vitest";
import { TcpBinaryTransport } from "../tcp-binary";
import { createTcpEchoServer } from "./tcp-echo-server";
import { defineTransportTests } from "./transport-test-suite";

defineTransportTests({
    name: "TcpBinaryTransport",
    dataMode: "binary",
    createServer: createTcpEchoServer,
    createTransportFactory: (port) =>
        TcpBinaryTransport.createFactory("127.0.0.1", port),
});

describe("TcpBinaryTransport — stale socket cleanup", () => {
    it("clears socket ref on failed open() so subsequent API calls throw", async () => {
        const transport = new TcpBinaryTransport("127.0.0.1", 1);

        await expect(transport.open()).rejects.toThrow();

        // After failed open, socket must be null — methods should throw
        expect(() => transport.send("test")).toThrow("not connected");
        expect(() => transport.onMessage(() => {})).toThrow("not connected");
    });
});
