import { describe, it, expect } from "vitest";
import { FailIf } from "./fail-if";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("FailIf decorator", () => {
    it("returns Failed without ticking child when condition is true", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new FailIf(child, "check", () => true);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(0);
    });

    it("ticks child normally when condition is false", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new FailIf(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("passes through Running from child when condition is false", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new FailIf(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts child when condition flips true while child was Running", () => {
        let conditionValue = false;
        const child = new StubAction(NodeResult.Running);
        const decorator = new FailIf(child, "check", () => conditionValue);

        BTNode.Tick(decorator, createTickContext());
        expect(child.abortCount).toBe(0);

        conditionValue = true;
        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });
});
