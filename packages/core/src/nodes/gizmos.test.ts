import { describe, it, expect } from "vitest";
import { Gizmos } from "./gizmos";
import { BTNode } from "../base/node";
import { NodeResult, NodeFlags } from "../base/types";
import { createTickContext, createTracingTickContext, StubAction } from "../test-helpers";

describe("Gizmos", () => {
    it("returns Skipped when debug is disabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const gizmos = new Gizmos([child]);

        const result = BTNode.Tick(gizmos, createTickContext({ isDebugEnabled: false }));

        expect(result).toBe(NodeResult.Skipped);
    });

    it("returns Skipped when debug is enabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const gizmos = new Gizmos([child]);

        const result = BTNode.Tick(gizmos, createTickContext({ isDebugEnabled: true }));

        expect(result).toBe(NodeResult.Skipped);
    });

    it("does not tick children when debug is disabled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const gizmos = new Gizmos([child]);

        BTNode.Tick(gizmos, createTickContext({ isDebugEnabled: false }));

        expect(child.tickCount).toBe(0);
    });

    it("ticks children in sequence when debug is enabled", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const gizmos = new Gizmos([child1, child2]);

        BTNode.Tick(gizmos, createTickContext({ isDebugEnabled: true }));

        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
    });

    it("aborts Running children", () => {
        const child = new StubAction(NodeResult.Running);
        const gizmos = new Gizmos([child]);

        BTNode.Tick(gizmos, createTickContext({ isDebugEnabled: true }));

        expect(child.abortCount).toBe(1);
    });

    it("gate appears in trace as Failed when debug off", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const gizmos = new Gizmos([child]);
        const ctx = createTracingTickContext({ isDebugEnabled: false });
        const gateNode = gizmos.nodes[0]!;

        BTNode.Tick(gizmos, ctx);

        const gateEvent = ctx.events.find(e => e.nodeId === gateNode.id);
        expect(gateEvent).toBeDefined();
        expect(gateEvent!.result).toBe(NodeResult.Failed);
    });

    it("gate appears in trace as Succeeded when debug on", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const gizmos = new Gizmos([child]);
        const ctx = createTracingTickContext({ isDebugEnabled: true });
        const gateNode = gizmos.nodes[0]!;

        BTNode.Tick(gizmos, ctx);

        const gateEvent = ctx.events.find(e => e.nodeId === gateNode.id);
        expect(gateEvent).toBeDefined();
        expect(gateEvent!.result).toBe(NodeResult.Succeeded);

        const childEvent = ctx.events.find(e => e.nodeId === child.id);
        expect(childEvent).toBeDefined();
        expect(childEvent!.result).toBe(NodeResult.Succeeded);
    });

    it("has NodeFlags.Debug flag", () => {
        const gizmos = new Gizmos([new StubAction()]);

        expect(gizmos.nodeFlags & NodeFlags.Debug).toBeTruthy();
    });
});
