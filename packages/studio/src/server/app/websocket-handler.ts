import WebSocket from "ws";
import { StudioService } from "../domain";
import { DefaultAgentGateway } from "./agent-gateway";
import { MessageType } from "@behavior-tree-ist/studio-transport";

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
                console.log(`[WebSocketHandler] Received ${message.type} from ${message.payload.clientId || clientId} for treeId ${message.payload.treeId || 'N/A'}`);

                // PROTOCOL_VERSION check could be here

                if (message.type === MessageType.ClientHello) {
                    clientId = message.payload.clientId;
                    if (clientId) {
                        this.connections.set(clientId, ws);
                        this.service.registerClient(clientId);
                    }
                } else if (message.type === MessageType.CommandAck) {
                    this.gateway.emitAck(message.payload);
                } else if (clientId) {
                    // Tree registry and ticks handling
                    if (message.type === MessageType.RegisterTree) {
                        this.service.registerTree(clientId, message.payload.treeId, message.payload.serializedTree);
                    } else if (message.type === MessageType.TreeUpdate) {
                        this.service.updateTree(clientId, message.payload.treeId, message.payload.serializedTree);
                    } else if (message.type === MessageType.RemoveTree) {
                        this.service.unregisterTree(clientId, message.payload.treeId);
                    } else if (message.type === MessageType.TickBatch) {
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
