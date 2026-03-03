import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudioLink, StudioLinkOptions } from "./studio-link";
import { Transport, TransportData } from "./transport";
import { InboundMessage, MessageType, OutboundMessage, PROTOCOL_VERSION } from "./protocol";
import { OffFunction } from "../types";
import { StudioCommandType } from "./types";
import { SerializableNode, TickRecord } from "../base";

// --- MockTransport ---

type MessageHandler = (data: TransportData) => void;
type ErrorHandler = (error: Error) => void;
type CloseHandler = () => void;

interface MockTransport extends Transport {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    _resolveOpen: () => void;
    _rejectOpen: (error: Error) => void;
    _simulateMessage: (data: TransportData) => void;
    _simulateClose: () => void;
    _simulateError: (error: Error) => void;
}

function createMockTransport(): MockTransport {
    const messageHandlers = new Set<MessageHandler>();
    const errorHandlers = new Set<ErrorHandler>();
    const closeHandlers = new Set<CloseHandler>();

    let resolveOpen: () => void;
    let rejectOpen: (error: Error) => void;

    const mock: MockTransport = {
        open() {
            return new Promise<void>((resolve, reject) => {
                resolveOpen = resolve;
                rejectOpen = reject;
            });
        },
        send: vi.fn(),
        close: vi.fn(),
        onMessage(handler: MessageHandler): OffFunction {
            messageHandlers.add(handler);
            return () => messageHandlers.delete(handler);
        },
        onError(handler: ErrorHandler): OffFunction {
            errorHandlers.add(handler);
            return () => errorHandlers.delete(handler);
        },
        onClose(handler: CloseHandler): OffFunction {
            closeHandlers.add(handler);
            return () => closeHandlers.delete(handler);
        },
        get _resolveOpen() { return resolveOpen; },
        get _rejectOpen() { return rejectOpen; },
        _simulateMessage(data: TransportData) {
            for (const h of messageHandlers) h(data);
        },
        _simulateClose() {
            for (const h of closeHandlers) h();
        },
        _simulateError(error: Error) {
            for (const h of errorHandlers) h(error);
        },
    };

    return mock;
}

// --- Helpers ---

let transports: MockTransport[];

function createStudioLink(overrides?: Partial<StudioLinkOptions>): StudioLink {
    return new StudioLink({
        createTransport: overrides?.createTransport ?? (() => {
            const t = createMockTransport();
            transports.push(t);
            return t;
        }),
        serialize: overrides?.serialize,
        deserialize: overrides?.deserialize,
        reconnectDelayMs: overrides?.reconnectDelayMs ?? 0,
    });
}

function lastTransport(): MockTransport {
    return transports[transports.length - 1];
}

async function connectLink(link: StudioLink): Promise<MockTransport> {
    link.open();
    const transport = lastTransport();
    transport._resolveOpen();
    await Promise.resolve(); // flush microtask
    return transport;
}

// --- Tests ---

describe("StudioLink", () => {
    beforeEach(() => {
        transports = [];
    });

    describe("serialization", () => {
        it("sendHello serializes with correct t field and protocol version", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            link.sendHello("client-1", "session-1");

            expect(transport.send).toHaveBeenCalledTimes(1);
            const payload = JSON.parse(transport.send.mock.calls[0][0] as string);
            expect(payload).toEqual({
                t: MessageType.Hello,
                version: PROTOCOL_VERSION,
                clientId: "client-1",
                sessionId: "session-1",
            });
        });

        it("sendTreeRegistered serializes with correct t field", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const serializedTree = { id: "root", type: "action" } as unknown as SerializableNode;
            link.sendTreeRegistered("tree-1", serializedTree);

            const payload = JSON.parse(transport.send.mock.calls[0][0] as string);
            expect(payload.t).toBe(MessageType.TreeRegistered);
            expect(payload.treeId).toBe("tree-1");
            expect(payload.serializedTree).toEqual(serializedTree);
        });

        it("sendTreeRemoved serializes with correct t field", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            link.sendTreeRemoved("tree-1");

            const payload = JSON.parse(transport.send.mock.calls[0][0] as string);
            expect(payload.t).toBe(MessageType.TreeRemoved);
            expect(payload.treeId).toBe("tree-1");
        });

        it("sendTickBatch serializes with correct t field", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const ticks = [{ tickId: 1 }] as unknown as TickRecord[];
            link.sendTickBatch("tree-1", ticks);

            const payload = JSON.parse(transport.send.mock.calls[0][0] as string);
            expect(payload.t).toBe(MessageType.TickBatch);
            expect(payload.treeId).toBe("tree-1");
            expect(payload.ticks).toEqual(ticks);
        });

        it("sendCommandResponse serializes with correct t field", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            link.sendCommandResponse("corr-1", { success: true });

            const payload = JSON.parse(transport.send.mock.calls[0][0] as string);
            expect(payload.t).toBe(MessageType.CommandResponse);
            expect(payload.correlationId).toBe("corr-1");
            expect(payload.response).toEqual({ success: true });
        });
    });

    describe("deserialization", () => {
        it("dispatches inbound Command message to onCommand handlers", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const handler = vi.fn();
            link.onCommand(handler);

            const command = { correlationId: "c1", treeId: "t1", command: StudioCommandType.EnableStreaming };
            transport._simulateMessage(JSON.stringify({ t: MessageType.Command, command }));

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(command);
        });

        it("emits error on malformed message", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const errorHandler = vi.fn();
            link.onError(errorHandler);

            transport._simulateMessage("not valid json{{{");

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        });

        it("emits error on binary data with default deserializer", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const errorHandler = vi.fn();
            link.onError(errorHandler);

            transport._simulateMessage(new Uint8Array([1, 2, 3]));

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler.mock.calls[0][0].message).toMatch(/binary/i);
        });
    });

    describe("custom serialization", () => {
        it("uses custom serialize and deserialize functions", async () => {
            const customSerialize = vi.fn((_msg: OutboundMessage) => "custom-payload" as TransportData);
            const customDeserialize = vi.fn((_data: TransportData): InboundMessage => ({
                t: MessageType.Command,
                command: { correlationId: "c1", treeId: "t1", command: StudioCommandType.EnableStreaming },
            }));

            const link = createStudioLink({
                serialize: customSerialize,
                deserialize: customDeserialize,
            });
            const transport = await connectLink(link);

            // Test serialize
            link.sendHello("c", "s");
            expect(customSerialize).toHaveBeenCalledTimes(1);
            expect(transport.send).toHaveBeenCalledWith("custom-payload");

            // Test deserialize
            const handler = vi.fn();
            link.onCommand(handler);
            transport._simulateMessage("raw-data");
            expect(customDeserialize).toHaveBeenCalledWith("raw-data");
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe("connection lifecycle", () => {
        it("open() calls factory and creates transport", () => {
            const link = createStudioLink();
            link.open();

            expect(transports).toHaveLength(1);
        });

        it("emits connected event when transport opens successfully", async () => {
            const link = createStudioLink();
            const handler = vi.fn();
            link.onConnected(handler);

            await connectLink(link);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(link.isConnected).toBe(true);
        });

        it("open() is no-op if already connecting", () => {
            const link = createStudioLink();
            link.open();
            link.open(); // second call

            expect(transports).toHaveLength(1);
        });
    });

    describe("failed connection", () => {
        it("emits error and returns to idle on connection failure", async () => {
            const link = createStudioLink();
            const errorHandler = vi.fn();
            link.onError(errorHandler);

            link.open();
            const transport = lastTransport();
            transport._rejectOpen(new Error("connection refused"));
            await Promise.resolve(); // flush microtask

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler.mock.calls[0][0].message).toBe("connection refused");
            expect(link.isConnected).toBe(false);
        });

        it("discards transport on failed connection", async () => {
            const link = createStudioLink();
            link.open();
            const transport = lastTransport();
            transport._rejectOpen(new Error("fail"));
            await Promise.resolve();

            expect(transport.close).toHaveBeenCalled();
        });
    });

    describe("disconnection", () => {
        it("emits disconnected and discards transport on transport close", async () => {
            const link = createStudioLink();
            const disconnectedHandler = vi.fn();
            link.onDisconnected(disconnectedHandler);

            const transport = await connectLink(link);
            transport._simulateClose();

            expect(disconnectedHandler).toHaveBeenCalledTimes(1);
            expect(link.isConnected).toBe(false);
        });
    });

    describe("reconnection", () => {
        it("creates new transport on tick() after disconnect", async () => {
            const link = createStudioLink({ reconnectDelayMs: 0 });
            await connectLink(link);
            lastTransport()._simulateClose();

            expect(transports).toHaveLength(1);

            link.tick(); // should trigger reconnection

            expect(transports).toHaveLength(2);
        });

        it("respects reconnectDelayMs before retrying", async () => {
            const link = createStudioLink({ reconnectDelayMs: 5000 });
            await connectLink(link);
            lastTransport()._simulateClose();

            link.tick(); // too soon — should not reconnect

            expect(transports).toHaveLength(1);
        });
    });

    describe("single promise guarantee", () => {
        it("multiple tick() calls while connecting do not create multiple transports", () => {
            const link = createStudioLink();
            link.open();

            link.tick();
            link.tick();
            link.tick();

            expect(transports).toHaveLength(1);
        });
    });

    describe("send guards", () => {
        it("sends are no-ops when disconnected", () => {
            const link = createStudioLink();
            // Not connected — all sends should be silent no-ops
            link.sendHello("c", "s");
            link.sendTreeRegistered("t", {} as unknown as SerializableNode);
            link.sendTreeRemoved("t");
            link.sendTickBatch("t", []);
            link.sendCommandResponse("c", { success: true });
            // No error thrown, no transport to check
        });

        it("sends are no-ops after close()", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);
            link.close();
            transport.send.mockClear();

            link.sendHello("c", "s");

            expect(transport.send).not.toHaveBeenCalled();
        });
    });

    describe("close()", () => {
        it("tears down transport and emits disconnected if was connected", async () => {
            const link = createStudioLink();
            const disconnectedHandler = vi.fn();
            link.onDisconnected(disconnectedHandler);

            const transport = await connectLink(link);
            link.close();

            expect(transport.close).toHaveBeenCalled();
            expect(disconnectedHandler).toHaveBeenCalledTimes(1);
            expect(link.isConnected).toBe(false);
        });

        it("does not emit disconnected if was not connected", () => {
            const link = createStudioLink();
            const disconnectedHandler = vi.fn();
            link.onDisconnected(disconnectedHandler);

            link.open(); // connecting, not yet connected
            link.close();

            expect(disconnectedHandler).not.toHaveBeenCalled();
        });

        it("tick() is no-op after close()", async () => {
            const link = createStudioLink({ reconnectDelayMs: 0 });
            await connectLink(link);
            link.close();

            link.tick(); // should not create new transport

            expect(transports).toHaveLength(1);
        });
    });

    describe("onError", () => {
        it("surfaces transport errors to listeners", async () => {
            const link = createStudioLink();
            const errorHandler = vi.fn();
            link.onError(errorHandler);

            const transport = await connectLink(link);
            transport._simulateError(new Error("transport broken"));

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler.mock.calls[0][0].message).toBe("transport broken");
        });
    });

    describe("unsubscription", () => {
        it("onCommand returns working off function", async () => {
            const link = createStudioLink();
            const transport = await connectLink(link);

            const handler = vi.fn();
            const off = link.onCommand(handler);

            off();

            const command = { correlationId: "c1", treeId: "t1", command: StudioCommandType.EnableStreaming };
            transport._simulateMessage(JSON.stringify({ t: MessageType.Command, command }));

            expect(handler).not.toHaveBeenCalled();
        });

        it("onConnected returns working off function", () => {
            const link = createStudioLink();
            const handler = vi.fn();
            const off = link.onConnected(handler);
            off();

            link.open();
            lastTransport()._resolveOpen();

            // handler should not have been called but we need to flush
            return Promise.resolve().then(() => {
                expect(handler).not.toHaveBeenCalled();
            });
        });
    });
});
