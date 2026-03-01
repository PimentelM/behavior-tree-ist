import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketTransport } from "./websocket-transport";

class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    public readyState = MockWebSocket.CONNECTING;
    public url: string;

    public onopen: (() => void) | null = null;
    public onclose: (() => void) | null = null;
    public onmessage: ((e: any) => void) | null = null;
    public onerror: (() => void) | null = null;

    public sentData: string[] = [];

    constructor(url: string) {
        this.url = url;
    }

    send(data: string) {
        this.sentData.push(data);
    }

    close() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose();
    }

    // Trigger methods for tests
    triggerOpen() {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) this.onopen();
    }

    triggerMessage(data: string) {
        if (this.onmessage) this.onmessage({ data });
    }

    triggerClose() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose();
    }
}

describe("WebSocketTransport", () => {
    let ws: MockWebSocket;

    beforeEach(() => {
        vi.useFakeTimers();
    });

    const createTransport = () => {
        let instance: MockWebSocket;
        const MockCtor = function (url: string) {
            instance = new MockWebSocket(url);
            ws = instance;
            return instance;
        } as any;
        MockCtor.CONNECTING = 0;
        MockCtor.OPEN = 1;
        MockCtor.CLOSING = 2;
        MockCtor.CLOSED = 3;

        const Transport = new WebSocketTransport("ws://test", {
            WebSocketImpl: MockCtor
        });
        return Transport;
    };

    it("sends data when connected", () => {
        const transport = createTransport();
        ws.triggerOpen();
        expect(transport.isConnected).toBe(true);

        transport.send("hello");
        expect(ws.sentData).toEqual(["hello"]);
    });

    it("silently drops send if disconnected", () => {
        const transport = createTransport();
        expect(transport.isConnected).toBe(false);

        transport.send("hello");
        expect(ws.sentData).toEqual([]);
    });

    it("onMessage fires when ws receives message", () => {
        const transport = createTransport();
        ws.triggerOpen();

        const handler = vi.fn();
        transport.onMessage(handler);

        ws.triggerMessage("test data");
        expect(handler).toHaveBeenCalledWith("test data");
    });

    it("onOpen fires when ws connects", () => {
        const transport = createTransport();
        const handler = vi.fn();
        transport.onOpen(handler);

        ws.triggerOpen();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("onClose fires when ws disconnects", () => {
        const transport = createTransport();
        ws.triggerOpen();
        const handler = vi.fn();
        transport.onClose(handler);

        ws.triggerClose();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(transport.isConnected).toBe(false);
    });

    it("reconnects with exponential backoff on unexpected close", () => {
        const transport = createTransport();
        ws.triggerOpen();

        ws.triggerClose();

        // 1st retry
        expect(transport.isConnected).toBe(false);
        vi.advanceTimersByTime(1000);
        expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
        ws.triggerClose(); // fails again

        // 2nd retry should happen at 2000
        vi.advanceTimersByTime(1000);
        // not triggered yet
        vi.advanceTimersByTime(1000);
        expect(ws.readyState).toBe(MockWebSocket.CONNECTING);
    });

    it("close() closes socket and stops reconnect", () => {
        const transport = createTransport();
        ws.triggerOpen();

        transport.close();

        expect(ws.readyState).toBe(MockWebSocket.CLOSED);
        vi.advanceTimersByTime(10000);
        // no reconnect happens
        expect(transport.isConnected).toBe(false);
    });
});
