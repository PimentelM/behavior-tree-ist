import { describe, expect, it } from "vitest";
import { BTNode, NodeResult } from "../../base";
import { Utility } from "./utility";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Utility Decorator", () => {
    it("returns the score from the scorer", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const utility = new Utility(action, () => 42);

        expect(utility.getScore(createTickContext())).toBe(42);
    });

    it("ticks the child node and returns its result", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const utility = new Utility(action, () => 0);

        const result = BTNode.Tick(utility, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(action.tickCount).toBe(1);
    });

    it('lets abort be forwarded to the child node', () => {
        const action = new StubAction(NodeResult.Running);
        const utility = new Utility(action, () => 0);

        const result = BTNode.Tick(utility, createTickContext());
        BTNode.Abort(utility, createTickContext());

        expect(result).toBe(NodeResult.Running);
        expect(action.abortCount).toBe(1);
    });

    it('allows child to reset normally', () => {
        const action = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const utility = new Utility(action, () => 0);

        const result1 = BTNode.Tick(utility, createTickContext());
        const result2 = BTNode.Tick(utility, createTickContext());


        expect(result1).toBe(NodeResult.Running);
        expect(result2).toBe(NodeResult.Succeeded);
        expect(action.resetCount).toBe(1);
    })
});
