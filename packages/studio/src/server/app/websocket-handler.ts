import WebSocket from "ws";
import { StudioService } from "../domain";
import { DefaultAgentGateway } from "./agent-gateway";

export class WebSocketHandler {
    private readonly connections = new Map<string, WebSocket>();
    public readonly gateway: DefaultAgentGateway;

    constructor(private readonly service: StudioService) {
        this.gateway = new DefaultAgentGateway(async (clientId, data) => {
            const ws = this.connections.get(clientId);
            if (!ws) {
                throw new Error(`Client ${clientId} is not connected.`);
            }
            if (ws.readyState === 1 /* OPEN */) {
                ws.send(data);
            }
        });
    }

    public handleConnection(ws: WebSocket): void {
        let clientId: string | undefined;

        ws.on("message", (data: string | Buffer) => {
            try {
                const message = JSON.parse(data.toString());

                // PROTOCOL_VERSION check could be here

                if (message.type === "client-hello") {
                    clientId = message.payload.clientId;
                    if (clientId) {
                        this.connections.set(clientId, ws);
                        this.service.registerClient(clientId);
                    }
                } else if (message.type === "command-ack") {
                    this.gateway.emitAck(message.payload);
                } else if (clientId) {
                    // Tree registry and ticks handling
                    if (message.type === "register-tree") {
                        this.service.registerTree(clientId, message.payload.treeId, message.payload.serializedTree);
                    } else if (message.type === "tree-update") {
                        this.service.updateTree(clientId, message.payload.treeId, message.payload.serializedTree);
                    } else if (message.type === "remove-tree") {
                        this.service.unregisterTree(clientId, message.payload.treeId);
                    } else if (message.type === "tick-batch") {
                        this.service.processTicks(clientId, message.payload.treeId, message.payload.ticks);
                    }
                }
            } catch (err) {
                console.error("Failed to parse or handle WebSocket message:", err);
            }
        });

        ws.on("close", () => {
            if (clientId) {
                this.connections.delete(clientId);
                this.service.unregisterClient(clientId);
            }
        });

        ws.on("error", (err) => {
            console.error("WebSocket error:", err);
        });
    }
}
