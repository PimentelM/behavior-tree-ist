import { describe, it, expect } from "vitest";
import { RunningIsFailure } from "./running-is-failure";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("RunningIsFailure", () => {
    it("converts Running to Failed", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new RunningIsFailure(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("aborts child when converting Running to Failed", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new RunningIsFailure(child);

        BTNode.Tick(decorator, createTickContext());

        expect(child.abortCount).toBe(1);
    });

    it("passes through Succeeded unchanged", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new RunningIsFailure(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.abortCount).toBe(0);
    });

    it("passes through Failed unchanged", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new RunningIsFailure(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(0);
    });
});
