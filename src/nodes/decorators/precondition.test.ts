import { describe, it, expect } from "vitest";
import { Precondition } from "./precondition";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Precondition decorator", () => {
    it("ticks child when predicate is true", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Precondition(child, "check", () => true);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("returns Failed when predicate is false without ticking child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Precondition(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(0);
    });

    it("aborts child when condition flips false while child was Running", () => {
        let conditionValue = true;
        const child = new StubAction(NodeResult.Running);
        const decorator = new Precondition(child, "check", () => conditionValue);

        BTNode.Tick(decorator, createTickContext());
        expect(child.abortCount).toBe(0);

        conditionValue = false;
        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });
});
