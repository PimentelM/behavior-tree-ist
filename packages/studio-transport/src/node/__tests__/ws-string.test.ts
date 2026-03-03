import { WsNodeStringTransport } from "../ws-string";
import { createWsEchoServer } from "./ws-echo-server";
import { defineTransportTests } from "./transport-test-suite";

defineTransportTests({
    name: "WsNodeStringTransport",
    dataMode: "string",
    createServer: createWsEchoServer,
    createTransportFactory: (port) =>
        WsNodeStringTransport.createFactory(`ws://127.0.0.1:${port}`),
});
