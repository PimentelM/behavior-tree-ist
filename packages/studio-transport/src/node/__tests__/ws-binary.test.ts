import { WsNodeBinaryTransport } from "../ws-binary";
import { createWsEchoServer } from "./ws-echo-server";
import { defineTransportTests } from "./transport-test-suite";

defineTransportTests({
    name: "WsNodeBinaryTransport",
    dataMode: "binary",
    createServer: createWsEchoServer,
    createTransportFactory: (port) =>
        WsNodeBinaryTransport.createFactory(`ws://127.0.0.1:${port}`),
});
