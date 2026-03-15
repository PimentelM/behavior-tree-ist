import { describe, it, expect } from "vitest";
import { TcpStringTransport } from "../tcp-string";
import { createTcpEchoServer } from "./tcp-echo-server";
import { defineTransportTests } from "./transport-test-suite";

defineTransportTests({
    name: "TcpStringTransport",
    dataMode: "string",
    createServer: createTcpEchoServer,
    createTransportFactory: (port) =>
        TcpStringTransport.createFactory("127.0.0.1", port),
});

describe("TcpStringTransport — stale socket cleanup", () => {
    it("clears socket ref on failed open() so subsequent API calls throw", async () => {
        const transport = new TcpStringTransport("127.0.0.1", 1);

        await expect(transport.open()).rejects.toThrow();

        // After failed open, socket must be null — methods should throw
        expect(() => transport.send("test")).toThrow("not connected");
        expect(() => transport.onMessage(() => {})).toThrow("not connected");
    });
});
