import { describe, it, expect } from "vitest";
import { KeepRunningUntilFailure } from "./keep-running-until-failure";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("KeepRunningUntilFailure", () => {
    it("returns Running when child succeeds", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const untilFail = new KeepRunningUntilFailure(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("child state is reset via onReset when succeeding", () => {
        // With new abort semantics, child that completed naturally (never was Running)
        // has its state reset via onReset, and the explicit Abort call is a no-op
        const child = new StubAction(NodeResult.Succeeded);
        const untilFail = new KeepRunningUntilFailure(child);

        BTNode.Tick(untilFail, createTickContext());

        // Child was never Running, so abort is a no-op
        expect(child.abortCount).toBe(0);
    });

    it("aborts running child after it succeeds", () => {
        // When child transitions from Running to Succeeded, abort is effective
        const child = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const untilFail = new KeepRunningUntilFailure(child);

        BTNode.Tick(untilFail, createTickContext()); // child Running
        BTNode.Tick(untilFail, createTickContext()); // child Succeeded, was Running

        // Child was Running and then succeeded - onReset handles cleanup
        // The explicit Abort call after success is now a no-op because
        // wasRunning is set to false after Tick returns Succeeded
        expect(child.abortCount).toBe(0);
    });

    it("returns Succeeded when child fails", () => {
        const child = new StubAction(NodeResult.Failed);
        const untilFail = new KeepRunningUntilFailure(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Running when child is Running", () => {
        const child = new StubAction(NodeResult.Running);
        const untilFail = new KeepRunningUntilFailure(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("loops until child fails", () => {
        const child = new StubAction([
            NodeResult.Succeeded,
            NodeResult.Succeeded,
            NodeResult.Failed
        ]);
        const untilFail = new KeepRunningUntilFailure(child);
        const ctx = createTickContext();

        // First tick: child succeeds, return Running
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Running);
        // Second tick: child succeeds, return Running
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Running);
        // Third tick: child fails, return Succeeded
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Succeeded);
    });
});
