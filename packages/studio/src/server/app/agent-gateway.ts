import { AgentGateway } from "../domain";

export type WebSocketSender = (clientId: string, data: string) => Promise<void>;

export class DefaultAgentGateway implements AgentGateway {
    private readonly listeners = new Set<(ack: { correlationId: string, success: boolean, error?: string }) => void>();

    constructor(private readonly send: WebSocketSender) { }

    async sendCommand(clientId: string, correlationId: string, command: string, treeId: string): Promise<void> {
        const payload = JSON.stringify({
            v: 1, // PROTOCOL_VERSION
            type: "command", // MessageType.Command
            payload: {
                correlationId,
                command,
                treeId
            }
        });

        await this.send(clientId, payload);
    }

    onCommandAck(handler: (ack: { correlationId: string, success: boolean, error?: string }) => void): () => void {
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }

    // Called by the WebSocket handler when an ack is received
    public emitAck(ack: { correlationId: string, success: boolean, error?: string }): void {
        for (const listener of this.listeners) {
            try {
                listener(ack);
            } catch (err) {
                console.error("Error in CommandAck listener", err);
            }
        }
    }
}
