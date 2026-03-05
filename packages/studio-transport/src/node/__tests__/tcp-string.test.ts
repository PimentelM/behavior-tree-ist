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
