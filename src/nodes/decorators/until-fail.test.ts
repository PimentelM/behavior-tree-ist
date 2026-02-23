import { describe, it, expect } from "vitest";
import { UntilFail } from "./until-fail";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("UntilFail", () => {
    it("returns Running when child succeeds", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const untilFail = new UntilFail(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts child after success to reset for next iteration", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const untilFail = new UntilFail(child);

        BTNode.Tick(untilFail, createTickContext());

        expect(child.abortCount).toBe(1);
    });

    it("returns Succeeded when child fails", () => {
        const child = new StubAction(NodeResult.Failed);
        const untilFail = new UntilFail(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Running when child is Running", () => {
        const child = new StubAction(NodeResult.Running);
        const untilFail = new UntilFail(child);

        const result = BTNode.Tick(untilFail, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("loops until child fails", () => {
        const child = new StubAction([
            NodeResult.Succeeded,
            NodeResult.Succeeded,
            NodeResult.Failed
        ]);
        const untilFail = new UntilFail(child);
        const ctx = createTickContext();

        // First tick: child succeeds, return Running
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Running);
        // Second tick: child succeeds, return Running
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Running);
        // Third tick: child fails, return Succeeded
        expect(BTNode.Tick(untilFail, ctx)).toBe(NodeResult.Succeeded);
    });
});
