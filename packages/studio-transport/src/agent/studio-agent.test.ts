import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudioAgent } from "./studio-agent";
import { TreeRegistry } from "../registry/tree-registry";
import { Transport, Unsubscribe } from "../transport/types";
import { BehaviourTree, Action, NodeResult, TickRecord } from "@behavior-tree-ist/core";
import { MessageType, PROTOCOL_VERSION, CommandType } from "../protocol";

class MockTransport implements Transport {
    public isConnected = false;
    public messages: string[] = [];
    private onOpenHandlers: (() => void)[] = [];
    private onCloseHandlers: (() => void)[] = [];
    private onMessageHandlers: ((data: string) => void)[] = [];

    send(data: string): void {
        this.messages.push(data);
    }
    onMessage(handler: (data: string) => void): Unsubscribe {
        this.onMessageHandlers.push(handler);
        return () => { this.onMessageHandlers = this.onMessageHandlers.filter(h => h !== handler); };
    }
    onOpen(handler: () => void): Unsubscribe {
        this.onOpenHandlers.push(handler);
        return () => { this.onOpenHandlers = this.onOpenHandlers.filter(h => h !== handler); };
    }
    onClose(handler: () => void): Unsubscribe {
        this.onCloseHandlers.push(handler);
        return () => { this.onCloseHandlers = this.onCloseHandlers.filter(h => h !== handler); };
    }
    close(): void {
        this.isConnected = false;
        for (const h of this.onCloseHandlers) h();
    }

    // Trigger methods
    triggerOpen() {
        this.isConnected = true;
        for (const h of this.onOpenHandlers) h();
    }

    triggerMessage(data: string) {
        for (const h of this.onMessageHandlers) h(data);
    }
}

describe("StudioAgent", () => {
    let registry: TreeRegistry;
    let transport: MockTransport;
    let agent: StudioAgent;
    let tree: BehaviourTree;

    beforeEach(() => {
        registry = new TreeRegistry();
        transport = new MockTransport();
        agent = new StudioAgent("client-1", registry);
        tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
    });

    it("sends ClientHello on transport open", () => {
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(1);
        const msg = JSON.parse(transport.messages[0]);
        expect(msg.type).toBe(MessageType.ClientHello);
        expect(msg.payload.clientId).toBe("client-1");
    });

    it("sends RegisterTree for existing registry entries on connect", () => {
        registry.register("tree-1", tree);
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(2);
        const [hello, register] = transport.messages.map(m => JSON.parse(m));

        expect(hello.type).toBe(MessageType.ClientHello);
        expect(register.type).toBe(MessageType.RegisterTree);
        expect(register.payload.treeId).toBe("tree-1");
        expect(register.payload.serializedTree).toBeDefined();
    });

    it("sends RegisterTree when tree is registered after connect", () => {
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 }); // flush ClientHello
        transport.messages = [];

        registry.register("tree-1", tree);
        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(1);
        const register = JSON.parse(transport.messages[0]);
        expect(register.type).toBe(MessageType.RegisterTree);
        expect(register.payload.treeId).toBe("tree-1");
    });

    it("sends RemoveTree when tree is removed", () => {
        registry.register("tree-1", tree);
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        registry.remove("tree-1");
        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(1);
        const remove = JSON.parse(transport.messages[0]);
        expect(remove.type).toBe(MessageType.RemoveTree);
        expect(remove.payload.treeId).toBe("tree-1");
    });

    it("only sends TickBatch when streaming is enabled for the tree", () => {
        registry.register("tree-1", tree, { streaming: true });
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        tree.tick({ now: 100 });
        // The registry needs to be informed manually (usually done by the integrator)
        // Wait, the agent hook is attached to `registry.onTick`
        // We have to call reportTick
        registry.reportTick("tree-1", { tickId: 100, timestamp: 100, events: [], refEvents: [] });

        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(1);
        const tickMsg = JSON.parse(transport.messages[0]);
        expect(tickMsg.type).toBe(MessageType.TickBatch);
        expect(tickMsg.payload.treeId).toBe("tree-1");
        expect(tickMsg.payload.ticks).toHaveLength(1);
    });

    it("does NOT send TickBatch when streaming is disabled (drops tick)", () => {
        registry.register("tree-1", tree, { streaming: false });
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        registry.reportTick("tree-1", { tickId: 100, timestamp: 100, events: [], refEvents: [] });

        agent.tick({ now: 0 });

        expect(transport.messages).toHaveLength(0);
    });

    it("handles Command -> enable-streaming: streaming enabled on registry, CommandAck sent", () => {
        registry.register("tree-1", tree, { streaming: false });
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        transport.triggerMessage(JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: { correlationId: "c1", treeId: "tree-1", command: CommandType.EnableStreaming }
        }));

        agent.tick({ now: 0 });

        expect(registry.isStreaming("tree-1")).toBe(true);
        expect(transport.messages).toHaveLength(1);
        const ack = JSON.parse(transport.messages[0]);
        expect(ack.type).toBe(MessageType.CommandAck);
        expect(ack.payload.correlationId).toBe("c1");
        expect(ack.payload.success).toBe(true);
    });

    it("handles Command -> disable-streaming: streaming disabled, ack sent", () => {
        registry.register("tree-1", tree, { streaming: true });
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        transport.triggerMessage(JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: { correlationId: "c2", treeId: "tree-1", command: CommandType.DisableStreaming }
        }));

        agent.tick({ now: 0 });

        expect(registry.isStreaming("tree-1")).toBe(false);
        const ack = JSON.parse(transport.messages[0]);
        expect(ack.payload.success).toBe(true);
    });

    it("handles Command -> enable-state-trace: calls tree methods, ack sent", () => {
        registry.register("tree-1", tree);
        const spy = vi.spyOn(tree, 'enableStateTrace');
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        transport.triggerMessage(JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: { correlationId: "c3", treeId: "tree-1", command: CommandType.EnableStateTrace }
        }));

        agent.tick({ now: 0 });

        expect(spy).toHaveBeenCalledTimes(1);
        const ack = JSON.parse(transport.messages[0]);
        expect(ack.payload.success).toBe(true);
    });

    it("handles Command -> enable-profiling returns false if no cached provider exists on tree", () => {
        registry.register("tree-1", tree);
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        transport.triggerMessage(JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: { correlationId: "c4", treeId: "tree-1", command: CommandType.EnableProfiling }
        }));

        agent.tick({ now: 0 });

        const ack = JSON.parse(transport.messages[0]);
        expect(ack.payload.success).toBe(false);
        expect(ack.payload.errorCode).toBe("COMMAND_EXECUTION_ERROR");
        expect(ack.payload.errorMessage).toMatch(/Cannot enable profiling without a cached time provider/);
    });

    it("command for unknown tree sends CommandAck with success: false and error", () => {
        agent.connect(transport);
        transport.triggerOpen();
        agent.tick({ now: 0 });
        transport.messages = [];

        transport.triggerMessage(JSON.stringify({
            v: PROTOCOL_VERSION,
            type: MessageType.Command,
            payload: { correlationId: "c5", treeId: "unknown", command: CommandType.EnableStreaming }
        }));

        agent.tick({ now: 0 });

        const ack = JSON.parse(transport.messages[0]);
        expect(ack.payload.success).toBe(false);
        expect(ack.payload.errorCode).toBe("TREE_NOT_FOUND");
        expect(ack.payload.errorMessage).toMatch(/Tree "unknown" not found/);
    });

    it("backpressure: when queue is full, oldest message is evicted", () => {
        const limitedAgent = new StudioAgent("client-1", registry, { queueCapacity: 2 });
        limitedAgent.connect(transport);
        transport.triggerOpen(); // generates 1 ClientHello

        // Let's generate 2 RegisterTree events (which pushes the queue above 2, evicting ClientHello)
        registry.register("tree-1", tree);
        registry.register("tree-2", tree);

        limitedAgent.tick({ now: 0 });

        // Expected to see 2 Registration events, but no ClientHello since it got evicted
        expect(transport.messages).toHaveLength(2);
        const [msg1, msg2] = transport.messages.map(m => JSON.parse(m));

        expect(msg1.type).toBe(MessageType.RegisterTree);
        expect(msg1.payload.treeId).toBe("tree-1");

        expect(msg2.type).toBe(MessageType.RegisterTree);
        expect(msg2.payload.treeId).toBe("tree-2");
    });
});
