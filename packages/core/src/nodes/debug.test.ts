import { describe, it, expect } from "vitest";
import { DebugNode } from "./debug";
import { BTNode } from "../base/node";
import { NodeResult, NodeFlags } from "../base/types";
import { createTickContext, createTracingTickContext, StubAction } from "../test-helpers";

describe("DebugNode", () => {
    it("returns Skipped when debug is disabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debug = new DebugNode([child]);

        const result = BTNode.Tick(debug, createTickContext({ isDebugEnabled: false }));

        expect(result).toBe(NodeResult.Skipped);
    });

    it("returns Skipped when debug is enabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debug = new DebugNode([child]);

        const result = BTNode.Tick(debug, createTickContext({ isDebugEnabled: true }));

        expect(result).toBe(NodeResult.Skipped);
    });

    it("does not tick children when debug is disabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debug = new DebugNode([child]);

        BTNode.Tick(debug, createTickContext({ isDebugEnabled: false }));

        expect(child.tickCount).toBe(0);
    });

    it("ticks children in sequence when debug is enabled", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const debug = new DebugNode([child1, child2]);

        BTNode.Tick(debug, createTickContext({ isDebugEnabled: true }));

        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
    });

    it("aborts Running children", () => {
        const child = new StubAction(NodeResult.Running);
        const debug = new DebugNode([child]);

        BTNode.Tick(debug, createTickContext({ isDebugEnabled: true }));

        expect(child.abortCount).toBe(1);
    });

    it("gate appears in trace as Failed when debug off", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debug = new DebugNode([child]);
        const ctx = createTracingTickContext({ isDebugEnabled: false });
        const gateNode = debug.nodes[0]!;

        BTNode.Tick(debug, ctx);

        const gateEvent = ctx.events.find(e => e.nodeId === gateNode.id);
        expect(gateEvent).toBeDefined();
        expect(gateEvent!.result).toBe(NodeResult.Failed);
    });

    it("gate appears in trace as Succeeded when debug on", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debug = new DebugNode([child]);
        const ctx = createTracingTickContext({ isDebugEnabled: true });
        const gateNode = debug.nodes[0]!;

        BTNode.Tick(debug, ctx);

        const gateEvent = ctx.events.find(e => e.nodeId === gateNode.id);
        expect(gateEvent).toBeDefined();
        expect(gateEvent!.result).toBe(NodeResult.Succeeded);

        const childEvent = ctx.events.find(e => e.nodeId === child.id);
        expect(childEvent).toBeDefined();
        expect(childEvent!.result).toBe(NodeResult.Succeeded);
    });

    it("has NodeFlags.Debug flag", () => {
        const debug = new DebugNode([new StubAction()]);

        expect(debug.nodeFlags & NodeFlags.Debug).toBeTruthy();
    });
});
