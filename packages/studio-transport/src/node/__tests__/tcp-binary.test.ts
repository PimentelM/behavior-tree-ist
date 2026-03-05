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
