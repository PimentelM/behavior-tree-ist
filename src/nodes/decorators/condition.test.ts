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

    it("does not abort child when predicate is false", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new Condition(child, "check", () => false);

        BTNode.Tick(decorator, createTickContext());

        expect(child.abortCount).toBe(0);
    });
});
