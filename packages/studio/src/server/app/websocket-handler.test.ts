import { describe, it, expect, vi, beforeEach, Mocked } from "vitest";
import { WebSocketHandler } from "./websocket-handler";
import { StudioService } from "../domain";
import { MessageType, PROTOCOL_VERSION } from "@behavior-tree-ist/studio-transport";
import WebSocket from "ws";

type EventHandler = (...args: unknown[]) => void;

interface MockWebSocket {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => void;
}

function createMockWebSocket(): MockWebSocket {
    const handlers: Record<string, EventHandler[]> = {};
    return {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn().mockImplementation((event: string, cb: EventHandler) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(cb);
        }),
        emit: (event: string, ...args: unknown[]) => {
            handlers[event]?.forEach(cb => cb(...args));
        }
    };
}

describe("WebSocketHandler", () => {
    let service: Mocked<StudioService>;
    let handler: WebSocketHandler;
    let mockWs: MockWebSocket;

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
        } as unknown as Mocked<StudioService>;

        handler = new WebSocketHandler(service);
        mockWs = createMockWebSocket();
    });

    it("handles connection, client-hello, and disconnect", () => {
        handler.handleConnection(mockWs as unknown as WebSocket);

        mockWs.emit("message", JSON.stringify({
            v: PROTOCOL_VERSION, type: MessageType.ClientHello, payload: { clientId: "c1" }
        }));
        expect(service.registerClient).toHaveBeenCalledWith("c1");

        mockWs.emit("close");
        expect(service.unregisterClient).toHaveBeenCalledWith("c1");
    });

    it("routes tree registry messages to service", () => {
        handler.handleConnection(mockWs as unknown as WebSocket);
        mockWs.emit("message", JSON.stringify({ type: MessageType.ClientHello, payload: { clientId: "c1" } }));

        mockWs.emit("message", JSON.stringify({ type: MessageType.RegisterTree, payload: { treeId: "t1", serializedTree: {} } }));
        expect(service.registerTree).toHaveBeenCalledWith("c1", "t1", {});

        mockWs.emit("message", JSON.stringify({ type: MessageType.TreeUpdate, payload: { treeId: "t1", serializedTree: { id: 2 } } }));
        expect(service.updateTree).toHaveBeenCalledWith("c1", "t1", { id: 2 });

        mockWs.emit("message", JSON.stringify({ type: MessageType.RemoveTree, payload: { treeId: "t1" } }));
        expect(service.unregisterTree).toHaveBeenCalledWith("c1", "t1");
    });

    it("routes tick batches", () => {
        handler.handleConnection(mockWs as unknown as WebSocket);
        mockWs.emit("message", JSON.stringify({ type: MessageType.ClientHello, payload: { clientId: "c1" } }));

        mockWs.emit("message", JSON.stringify({ type: MessageType.TickBatch, payload: { treeId: "t1", ticks: [] } }));
        expect(service.processTicks).toHaveBeenCalledWith("c1", "t1", []);
    });

    it("emits command acks to gateway", () => {
        handler.handleConnection(mockWs as unknown as WebSocket);

        const ackListener = vi.fn();
        handler.gateway.onCommandAck(ackListener);

        mockWs.emit("message", JSON.stringify({ type: MessageType.CommandAck, payload: { correlationId: "1", success: true } }));

        expect(ackListener).toHaveBeenCalledWith({ correlationId: "1", success: true });
    });

    it("gateway sends messages back to connected client", async () => {
        handler.handleConnection(mockWs as unknown as WebSocket);
        mockWs.emit("message", JSON.stringify({ type: MessageType.ClientHello, payload: { clientId: "c1" } }));

        await handler.gateway.sendCommand("c1", "123", "hello", "t1");

        expect(mockWs.send).toHaveBeenCalled();
        const payload = JSON.parse(mockWs.send.mock.calls[0][0] as string);
        expect(payload.type).toBe(MessageType.Command);
        expect(payload.payload.correlationId).toBe("123");
    });
});
