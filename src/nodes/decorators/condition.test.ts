import { describe, it, expect } from "vitest";
import { Condition } from "./condition";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Condition decorator", () => {
    it("ticks child when predicate is true", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Condition(child, "check", () => true);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("returns Failed when predicate is false without ticking child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Condition(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(0);
    });

    it("aborts child when condition flips false while child was Running", () => {
        let conditionValue = true;
        const child = new StubAction(NodeResult.Running);
        const decorator = new Condition(child, "check", () => conditionValue);

        BTNode.Tick(decorator, createTickContext());
        expect(child.abortCount).toBe(0);

        conditionValue = false;
        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });

    it("does not abort child when condition is false but child was not Running", () => {
        let conditionValue = true;
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Condition(child, "check", () => conditionValue);

        BTNode.Tick(decorator, createTickContext());

        conditionValue = false;
        BTNode.Tick(decorator, createTickContext());

        expect(child.abortCount).toBe(0);
    });

    it("does not abort child when condition was never true", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new Condition(child, "check", () => false);

        BTNode.Tick(decorator, createTickContext());

        expect(child.abortCount).toBe(0);
    });

    it("resets lastChildResult on abort", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new Condition(child, "check", () => true);

        BTNode.Tick(decorator, createTickContext());
        expect(decorator.getState()).toEqual({ lastChildResult: NodeResult.Running });

        BTNode.Abort(decorator, createTickContext());

        expect(decorator.getState()).toEqual({ lastChildResult: undefined });
    });

    it("getState returns lastChildResult", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new Condition(child, "check", () => true);

        expect(decorator.getState()).toEqual({ lastChildResult: undefined });

        BTNode.Tick(decorator, createTickContext());

        expect(decorator.getState()).toEqual({ lastChildResult: NodeResult.Running });
    });
});
