import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { WebSocketHandler } from "./websocket-handler";
import { StudioService } from "../domain";

describe("WebSocketHandler", () => {
    let service: Mocked<StudioService>;
    let handler: WebSocketHandler;
    let mockWs: any;

    beforeEach(() => {
        service = {
            registerClient: vi.fn(),
            unregisterClient: vi.fn(),
            registerTree: vi.fn(),
            unregisterTree: vi.fn(),
            updateTree: vi.fn(),
            processTicks: vi.fn(),
            enableStreaming: vi.fn(),
            disableStreaming: vi.fn(),
        } as any;

        handler = new WebSocketHandler(service);

        const handlers: Record<string, Function[]> = {};
        mockWs = {
            readyState: 1, // OPEN
            send: vi.fn(),
            on: vi.fn().mockImplementation((event: string, cb: Function) => {
                if (!handlers[event]) handlers[event] = [];
                handlers[event].push(cb);
            }),
            emit: (event: string, ...args: any[]) => {
                if (handlers[event]) {
                    handlers[event].forEach(cb => cb(...args));
                }
            }
        };
    });

    it("handles connection, client-hello, and disconnect", () => {
        handler.handleConnection(mockWs);

        mockWs.emit("message", JSON.stringify({
            v: 1, type: "client-hello", payload: { clientId: "c1" }
        }));
        expect(service.registerClient).toHaveBeenCalledWith("c1");

        mockWs.emit("close");
        expect(service.unregisterClient).toHaveBeenCalledWith("c1");
    });

    it("routes tree registry messages to service", () => {
        handler.handleConnection(mockWs);
        mockWs.emit("message", JSON.stringify({ type: "client-hello", payload: { clientId: "c1" } }));

        mockWs.emit("message", JSON.stringify({ type: "register-tree", payload: { treeId: "t1", serializedTree: {} } }));
        expect(service.registerTree).toHaveBeenCalledWith("c1", "t1", {});

        mockWs.emit("message", JSON.stringify({ type: "tree-update", payload: { treeId: "t1", serializedTree: { id: 2 } } }));
        expect(service.updateTree).toHaveBeenCalledWith("c1", "t1", { id: 2 });

        mockWs.emit("message", JSON.stringify({ type: "remove-tree", payload: { treeId: "t1" } }));
        expect(service.unregisterTree).toHaveBeenCalledWith("c1", "t1");
    });

    it("routes tick batches", () => {
        handler.handleConnection(mockWs);
        mockWs.emit("message", JSON.stringify({ type: "client-hello", payload: { clientId: "c1" } }));

        mockWs.emit("message", JSON.stringify({ type: "tick-batch", payload: { treeId: "t1", ticks: [] } }));
        expect(service.processTicks).toHaveBeenCalledWith("c1", "t1", []);
    });

    it("emits command acks to gateway", () => {
        handler.handleConnection(mockWs);

        const ackListener = vi.fn();
        handler.gateway.onCommandAck(ackListener);

        mockWs.emit("message", JSON.stringify({ type: "command-ack", payload: { correlationId: "1", success: true } }));

        expect(ackListener).toHaveBeenCalledWith({ correlationId: "1", success: true });
    });

    it("gateway sends messages back to connected client", async () => {
        handler.handleConnection(mockWs);
        mockWs.emit("message", JSON.stringify({ type: "client-hello", payload: { clientId: "c1" } }));

        await handler.gateway.sendCommand("c1", "123", "hello", "t1");

        expect(mockWs.send).toHaveBeenCalled();
        const payload = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(payload.type).toBe("command");
        expect(payload.payload.correlationId).toBe("123");
    });
});
