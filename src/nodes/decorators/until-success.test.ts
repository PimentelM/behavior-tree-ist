import { describe, it, expect } from "vitest";
import { UntilSuccess } from "./until-success";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("UntilSuccess", () => {
    it("returns Succeeded when child succeeds", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const untilSuccess = new UntilSuccess(child);

        const result = BTNode.Tick(untilSuccess, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Running when child fails", () => {
        const child = new StubAction(NodeResult.Failed);
        const untilSuccess = new UntilSuccess(child);

        const result = BTNode.Tick(untilSuccess, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("child state is reset via onReset when failing", () => {
        // With new abort semantics, child that completed naturally (never was Running)
        // has its state reset via onReset, and the explicit Abort call is a no-op
        const child = new StubAction(NodeResult.Failed);
        const untilSuccess = new UntilSuccess(child);

        BTNode.Tick(untilSuccess, createTickContext());

        // Child was never Running, so abort is a no-op
        expect(child.abortCount).toBe(0);
    });

    it("returns Running when child is Running", () => {
        const child = new StubAction(NodeResult.Running);
        const untilSuccess = new UntilSuccess(child);

        const result = BTNode.Tick(untilSuccess, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("loops until child succeeds", () => {
        const child = new StubAction([
            NodeResult.Failed,
            NodeResult.Failed,
            NodeResult.Succeeded
        ]);
        const untilSuccess = new UntilSuccess(child);
        const ctx = createTickContext();

        // First tick: child fails, return Running
        expect(BTNode.Tick(untilSuccess, ctx)).toBe(NodeResult.Running);
        // Second tick: child fails, return Running
        expect(BTNode.Tick(untilSuccess, ctx)).toBe(NodeResult.Running);
        // Third tick: child succeeds, return Succeeded
        expect(BTNode.Tick(untilSuccess, ctx)).toBe(NodeResult.Succeeded);
    });
});
