import { describe, it, expect } from "vitest";
import { RunOnce } from "./run-once";
import { BTNode, NodeResult } from "../../base";
import { StubAction, createTickContext } from "../../test-helpers";

describe("RunOnce", () => {
    it("runs child once and then caches success", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const runOnce = new RunOnce(child);

        const r1 = BTNode.Tick(runOnce, createTickContext());
        expect(r1).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);

        const r2 = BTNode.Tick(runOnce, createTickContext());
        expect(r2).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1); // Not ticked again
    });

    it("runs child once and then caches failure", () => {
        const child = new StubAction(NodeResult.Failed);
        const runOnce = new RunOnce(child);

        const r1 = BTNode.Tick(runOnce, createTickContext());
        expect(r1).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);

        const r2 = BTNode.Tick(runOnce, createTickContext());
        expect(r2).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1); // Not ticked again
    });

    it("continues running if child is running", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Running, NodeResult.Succeeded]);
        const runOnce = new RunOnce(child);

        expect(BTNode.Tick(runOnce, createTickContext())).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(1);

        expect(BTNode.Tick(runOnce, createTickContext())).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(2);

        expect(BTNode.Tick(runOnce, createTickContext())).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(3);

        expect(BTNode.Tick(runOnce, createTickContext())).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(3); // Not ticked on 4th call
    });

    it("can be forcefully reset to re-run child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const runOnce = new RunOnce(child);

        BTNode.Tick(runOnce, createTickContext()); // completes
        expect(child.tickCount).toBe(1);

        runOnce.forceReset();

        BTNode.Tick(runOnce, createTickContext()); // re-ticks
        expect(child.tickCount).toBe(2); // no longer cached
    });
});
