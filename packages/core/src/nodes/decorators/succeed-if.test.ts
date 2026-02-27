import { describe, it, expect } from "vitest";
import { SucceedIf } from "./succeed-if";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("SucceedIf decorator", () => {
    it("returns Succeeded without ticking child when condition is true", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new SucceedIf(child, "check", () => true);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(0);
    });

    it("ticks child normally when condition is false", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new SucceedIf(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);
    });

    it("passes through Running from child when condition is false", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new SucceedIf(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts child when condition flips true while child was Running", () => {
        let conditionValue = false;
        const child = new StubAction(NodeResult.Running);
        const decorator = new SucceedIf(child, "check", () => conditionValue);

        BTNode.Tick(decorator, createTickContext());
        expect(child.abortCount).toBe(0);

        conditionValue = true;
        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.abortCount).toBe(1);
    });
});
