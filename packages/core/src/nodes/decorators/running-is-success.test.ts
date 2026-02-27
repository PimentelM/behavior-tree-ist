import { describe, it, expect } from "vitest";
import { RunningIsSuccess } from "./running-is-success";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("RunningIsSuccess", () => {
    it("converts Running to Succeeded", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new RunningIsSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("aborts child when converting Running to Succeeded", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new RunningIsSuccess(child);

        BTNode.Tick(decorator, createTickContext());

        expect(child.abortCount).toBe(1);
    });

    it("passes through Succeeded unchanged", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new RunningIsSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.abortCount).toBe(0);
    });

    it("passes through Failed unchanged", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new RunningIsSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(0);
    });
});
