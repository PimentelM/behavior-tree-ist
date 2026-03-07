import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { TransportInterface, TransportData, TransportFactory } from "@bt-studio/core";

/**
 * Configuration for a test server that echoes messages back.
 */
export interface TestServerHarness {
    /** Start the server, return the port it's listening on. */
    start(): Promise<number>;
    /** Stop the server and close all connections. */
    stop(): Promise<void>;
}

export interface TransportTestConfig {
    /** Human-readable name for the describe block. */
    name: string;
    /** Whether this transport emits binary (Uint8Array) or string data. */
    dataMode: "binary" | "string";
    /** Create a test server harness (echo server). */
    createServer(): TestServerHarness;
    /** Given a port, return a TransportFactory for this transport. */
    createTransportFactory(port: number): TransportFactory;
}

/**
 * Shared test suite for all TransportInterface implementations.
 * Call this from each transport's test file with the appropriate config.
 */
export function defineTransportTests(config: TransportTestConfig): void {
    describe(config.name, () => {
        let server: TestServerHarness;
        let port: number;
        let transport: TransportInterface;

        beforeEach(async () => {
            server = config.createServer();
            port = await server.start();
        });

        afterEach(async () => {
            transport?.close();
            await server.stop();
        });

        function createAndOpen(): Promise<TransportInterface> {
            const factory = config.createTransportFactory(port);
            transport = factory();
            return transport.open().then(() => transport);
        }

        // --- Lifecycle ---

        it("should open and close without error", async () => {
            await createAndOpen();
            transport.close();
        });

        it("should fire onClose when server disconnects", async () => {
            await createAndOpen();

            const closed = new Promise<void>((resolve) => {
                transport.onClose(() => resolve());
            });

            // Absorb expected connection-reset errors when server is killed
            transport.onError(() => { });

            // Stop the server to force disconnect
            await server.stop();
            await closed;
        });

        it("should reject open() when nothing is listening", async () => {
            await server.stop();

            const factory = config.createTransportFactory(port);
            transport = factory();

            await expect(transport.open()).rejects.toThrow();
        });

        // --- Send/Receive ---

        it("should send and receive a single message", async () => {
            await createAndOpen();

            const received = new Promise<TransportData>((resolve) => {
                transport.onMessage((data) => resolve(data));
            });

            transport.send("hello");

            const data = await received;
            if (config.dataMode === "string") {
                expect(data).toBe("hello");
            } else {
                expect(data).toBeInstanceOf(Uint8Array);
                expect(new TextDecoder().decode(data as Uint8Array)).toBe("hello");
            }
        });

        it("should preserve message ordering across multiple messages", async () => {
            await createAndOpen();

            const messages: TransportData[] = [];
            const count = 20;

            const allReceived = new Promise<void>((resolve) => {
                transport.onMessage((data) => {
                    messages.push(data);
                    if (messages.length === count) resolve();
                });
            });

            for (let i = 0; i < count; i++) {
                transport.send(`msg-${i}`);
            }

            await allReceived;

            for (let i = 0; i < count; i++) {
                const expected = `msg-${i}`;
                const actual = config.dataMode === "string"
                    ? messages[i]
                    : new TextDecoder().decode(messages[i] as Uint8Array);
                expect(actual).toBe(expected);
            }
        });

        it("should handle binary data roundtrip", async () => {
            await createAndOpen();

            const payload = new Uint8Array([0x00, 0x01, 0xff, 0x80, 0x7f]);
            const received = new Promise<TransportData>((resolve) => {
                transport.onMessage((data) => resolve(data));
            });

            transport.send(payload);

            const data = await received;
            if (config.dataMode === "binary") {
                expect(data).toBeInstanceOf(Uint8Array);
                expect(Array.from(data as Uint8Array)).toEqual(Array.from(payload));
            } else {
                // String transport will have encoded/decoded through UTF-8
                expect(typeof data).toBe("string");
            }
        });

        it("should handle large payloads", async () => {
            await createAndOpen();

            // 64KB payload
            const large = new Uint8Array(65536);
            for (let i = 0; i < large.byteLength; i++) {
                large[i] = i % 256;
            }

            const received = new Promise<TransportData>((resolve) => {
                transport.onMessage((data) => resolve(data));
            });

            transport.send(large);

            const data = await received;
            if (config.dataMode === "binary") {
                expect(data).toBeInstanceOf(Uint8Array);
                expect((data as Uint8Array).byteLength).toBe(65536);
                expect(Array.from((data as Uint8Array).slice(0, 10))).toEqual(
                    Array.from(large.slice(0, 10))
                );
            } else {
                // String transport: large data still arrives as a string
                expect(typeof data).toBe("string");
            }
        });

        it("should handle rapid sequential sends", async () => {
            await createAndOpen();

            const messages: TransportData[] = [];
            const count = 100;

            const allReceived = new Promise<void>((resolve) => {
                transport.onMessage((data) => {
                    messages.push(data);
                    if (messages.length === count) resolve();
                });
            });

            for (let i = 0; i < count; i++) {
                transport.send(`rapid-${i}`);
            }

            await allReceived;
            expect(messages).toHaveLength(count);

            // Verify ordering
            for (let i = 0; i < count; i++) {
                const actual = config.dataMode === "string"
                    ? messages[i]
                    : new TextDecoder().decode(messages[i] as Uint8Array);
                expect(actual).toBe(`rapid-${i}`);
            }
        });

        // --- Cleanup ---

        it("should unsubscribe message handler via returned off function", async () => {
            await createAndOpen();

            const messages: TransportData[] = [];

            const off = transport.onMessage((data) => {
                messages.push(data);
            });

            // Send first message
            const firstReceived = new Promise<void>((resolve) => {
                const origLen = messages.length;
                const check = setInterval(() => {
                    if (messages.length > origLen) {
                        clearInterval(check);
                        resolve();
                    }
                }, 5);
            });

            transport.send("before-unsubscribe");
            await firstReceived;

            // Unsubscribe and send another message
            off();
            transport.send("after-unsubscribe");

            // Wait a bit to ensure no more messages arrive
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(messages).toHaveLength(1);
        });
    });
}
