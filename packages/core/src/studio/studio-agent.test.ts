import { describe, expect, it } from "vitest";
import { BehaviourTree } from "../tree";
import { StubAction } from "../test-helpers";
import { NodeResult } from "../base/types";
import { BehaviourTreeRegistry } from "./registry";
import { StudioAgent } from "./studio-agent";
import type { BinaryDuplexTransport } from "./transport";

class MockTransport implements BinaryDuplexTransport {
    public isOpen = true;
    public readonly sent: string[] = [];
    private readonly messageHandlers = new Set<(data: Uint8Array | string) => void>();
    private readonly closeHandlers = new Set<(reason?: string) => void>();
    private readonly errorHandlers = new Set<(error: Error) => void>();

    public send(data: Uint8Array | string): void {
        if (typeof data === "string") {
            this.sent.push(data);
            return;
        }

        let text = "";
        for (let i = 0; i < data.length; i++) {
            text += String.fromCharCode(data[i]);
        }
        this.sent.push(text);
    }

    public close(_code?: number, reason?: string): void {
        this.isOpen = false;
        for (const handler of this.closeHandlers) {
            handler(reason);
        }
    }

    public onMessage(handler: (data: Uint8Array | string) => void): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    public onClose(handler: (reason?: string) => void): () => void {
        this.closeHandlers.add(handler);
        return () => this.closeHandlers.delete(handler);
    }

    public onError(handler: (error: Error) => void): () => void {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    public emitMessage(data: unknown): void {
        const payload = JSON.stringify(data);
        for (const handler of this.messageHandlers) {
            handler(payload);
        }
    }
}

describe("StudioAgent", () => {
    it("flushes queued tick batches when tick() reaches due time", () => {
        const registry = new BehaviourTreeRegistry();
        const tree = new BehaviourTree(new StubAction(NodeResult.Succeeded));
        const { treeKey } = registry.registerTree(tree, { name: "Main" });
        const agent = new StudioAgent({
            registry,
            flushIntervalMs: 1,
            heartbeatIntervalMs: 10_000,
        });
        const transport = new MockTransport();
        agent.attachTransport(transport);

        tree.tick({ now: 1 });
        const result = agent.flush(5);

        expect(result.flushedTrees).toBe(1);

        const frames = transport.sent.map((raw) => JSON.parse(raw) as { kind: string; event?: string; data?: unknown });
        expect(frames.some((frame) => frame.kind === "evt" && frame.event === "agent.hello")).toBe(true);

        const tickBatchFrame = frames.find((frame) => frame.kind === "evt" && frame.event === "agent.tickBatch");
        expect(tickBatchFrame).toBeDefined();
        expect(tickBatchFrame?.data).toMatchObject({
            treeKey,
            droppedSinceLast: 0,
        });
    });

    it("handles agent.setStreaming requests", () => {
        const registry = new BehaviourTreeRegistry();
        const tree = new BehaviourTree(new StubAction(NodeResult.Succeeded));
        const { treeKey } = registry.registerTree(tree, { name: "Main" });
        const agent = new StudioAgent({
            registry,
            flushIntervalMs: 1,
            heartbeatIntervalMs: 10_000,
        });
        const transport = new MockTransport();
        agent.attachTransport(transport);

        transport.emitMessage({
            v: 1,
            kind: "req",
            id: "1",
            method: "agent.setStreaming",
            params: { enabled: false },
        });

        tree.tick({ now: 1 });
        agent.tick(5);

        const frames = transport.sent.map((raw) => JSON.parse(raw) as { kind: string; event?: string; id?: string; data?: { treeKey?: string } });
        const responseFrame = frames.find((frame) => frame.kind === "res" && frame.id === "1");
        expect(responseFrame).toBeDefined();
        const tickBatch = frames.find((frame) => frame.kind === "evt" && frame.event === "agent.tickBatch" && frame.data?.treeKey === treeKey);
        expect(tickBatch).toBeUndefined();
    });
});
