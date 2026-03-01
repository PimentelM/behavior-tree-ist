import { describe, it, expect, vi } from "vitest";
import { DefaultAgentGateway } from "./agent-gateway";

describe("DefaultAgentGateway", () => {
    it("sendCommand sends correct JSON payload", async () => {
        const sendMock = vi.fn().mockResolvedValue(undefined);
        const gateway = new DefaultAgentGateway(sendMock);

        await gateway.sendCommand("client-1", "corr-123", "enable-streaming", "tree-1");

        expect(sendMock).toHaveBeenCalledWith("client-1", JSON.stringify({
            v: 1,
            type: "command",
            payload: {
                correlationId: "corr-123",
                command: "enable-streaming",
                treeId: "tree-1"
            }
        }));
    });

    it("emits acks to listeners and allows unsubscribe", () => {
        const gateway = new DefaultAgentGateway(vi.fn());
        const listener = vi.fn();

        const unsub = gateway.onCommandAck(listener);

        gateway.emitAck({ correlationId: "1", success: true });
        expect(listener).toHaveBeenCalledWith({ correlationId: "1", success: true });

        unsub();
        gateway.emitAck({ correlationId: "2", success: true });
        expect(listener).toHaveBeenCalledTimes(1); // not called again
    });
});
