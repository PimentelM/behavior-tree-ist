import { AgentGateway } from "../domain";
import {
    MessageType,
    PROTOCOL_VERSION,
    type CommandAckMessage,
} from "@behavior-tree-ist/studio-transport";

type CommandAckPayload = CommandAckMessage["payload"];

export type WebSocketSender = (clientId: string, data: string) => Promise<void>;

export class DefaultAgentGateway implements AgentGateway {
    private readonly listeners = new Set<(ack: CommandAckPayload) => void>();

    constructor(private readonly send: WebSocketSender) { }

    async sendCommand(clientId: string, correlationId: string, command: string, treeId: string): Promise<void> {
        const payload = JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: {
                correlationId,
                command,
                treeId
            }
        });

        await this.send(clientId, payload);
    }

    onCommandAck(handler: (ack: CommandAckPayload) => void): () => void {
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }

    // Called by the WebSocket handler when an ack is received
    public emitAck(ack: CommandAckPayload): void {
        for (const listener of this.listeners) {
            try {
                listener(ack);
            } catch (err) {
                console.error("Error in CommandAck listener", err);
            }
        }
    }
}
