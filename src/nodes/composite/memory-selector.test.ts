import { describe, it, expect } from "vitest";
import { MemorySelector } from "./memory-selector";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("MemorySelector", () => {
    it("returns Succeeded when a child succeeds", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Succeeded);
        const sel = MemorySelector.from([child1, child2]);

        const result = BTNode.Tick(sel, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Failed when all children fail", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);
        const sel = MemorySelector.from([child1, child2]);

        const result = BTNode.Tick(sel, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("returns Running when a child is Running", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const sel = MemorySelector.from([child1, child2]);

        const result = BTNode.Tick(sel, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("resumes from the running child index on next tick", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const child3 = new StubAction(NodeResult.Failed);
        const sel = MemorySelector.from([child1, child2, child3]);

        BTNode.Tick(sel, createTickContext()); // child1 fails, child2 running
        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
        expect(child3.tickCount).toBe(0);

        BTNode.Tick(sel, createTickContext()); // resumes at child2, skips child1
        expect(child1.tickCount).toBe(1); // NOT ticked again
        expect(child2.tickCount).toBe(2);
    });

    it("resets running index after completion (Succeeded)", () => {
        const child1 = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const sel = MemorySelector.from([child1]);

        BTNode.Tick(sel, createTickContext()); // child1 running
        BTNode.Tick(sel, createTickContext()); // child1 succeeds

        expect(sel.runningChildIndex).toBeUndefined();

        BTNode.Tick(sel, createTickContext()); // should start from child1 again
        expect(child1.tickCount).toBe(3);
    });

    it("resets running index after completion (Failed)", () => {
        const child1 = new StubAction([NodeResult.Running, NodeResult.Failed]);
        const child2 = new StubAction(NodeResult.Failed);
        const sel = MemorySelector.from([child1, child2]);

        BTNode.Tick(sel, createTickContext());
        BTNode.Tick(sel, createTickContext());

        expect(sel.runningChildIndex).toBeUndefined();
    });

    it("only aborts Running children after the current child", () => {
        // child2 and child3 were never ticked (never Running), so abort is a no-op
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Succeeded);
        const sel = MemorySelector.from([child1, child2, child3]);

        BTNode.Tick(sel, createTickContext());

        expect(child2.abortCount).toBe(0);
        expect(child3.abortCount).toBe(0);
    });

    it("aborts running child when selector is aborted", () => {
        // When MemorySelector is aborted, it propagates to running children
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const sel = MemorySelector.from([child1, child2]);

        BTNode.Tick(sel, createTickContext()); // child1 fails, child2 Running, selector Running
        BTNode.Abort(sel, createTickContext()); // selector aborted, child2 aborted

        expect(child2.abortCount).toBe(1);
        // child1 was never Running, so not aborted
        expect(child1.abortCount).toBe(0);
    });

    it("onAbort resets runningChildIndex", () => {
        const child1 = new StubAction(NodeResult.Running);
        const sel = MemorySelector.from([child1]);

        BTNode.Tick(sel, createTickContext());
        expect(sel.runningChildIndex).toBe(0);

        BTNode.Abort(sel, createTickContext());

        expect(sel.runningChildIndex).toBeUndefined();
    });

    it("tracks runningChildIndex", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const sel = MemorySelector.from([child1, child2]);

        expect(sel.runningChildIndex).toBeUndefined();

        BTNode.Tick(sel, createTickContext());

        expect(sel.runningChildIndex).toBe(1);
    });

    it("from factory works with name", () => {
        const sel = MemorySelector.from("test", [new StubAction()]);

        expect(sel.name).toBe("test");
        expect(sel.nodes).toHaveLength(1);
    });

    it("from factory works without name", () => {
        const sel = MemorySelector.from([new StubAction()]);

        expect(sel.nodes).toHaveLength(1);
    });

    it("throws when no children", () => {
        const sel = MemorySelector.from([]);

        expect(() => BTNode.Tick(sel, createTickContext())).toThrow("has no nodes");
    });
});
