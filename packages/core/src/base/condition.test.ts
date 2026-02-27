import { describe, it, expect } from "vitest";
import { ConditionNode } from "./condition";
import { BTNode, TickContext } from "./node";
import { NodeResult } from "./types";
import { createNodeTicker, createTickContext } from "../test-helpers";

describe("ConditionNode", () => {
    it("returns Succeeded when predicate is true", () => {
        const condition = ConditionNode.from("isTrue", () => true);
        const ticker = createNodeTicker();

        const result = ticker.tick(condition);

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Failed when predicate is false", () => {
        const condition = ConditionNode.from("isFalse", () => false);
        const ticker = createNodeTicker();

        const result = ticker.tick(condition);

        expect(result).toBe(NodeResult.Failed);
    });

    it("passes TickContext to the predicate", () => {
        let receivedCtx: TickContext | undefined;
        const condition = ConditionNode.from("check", (ctx) => {
            receivedCtx = ctx;
            return true;
        });
        const ctx = createTickContext({ tickId: 99 });

        BTNode.Tick(condition, ctx);

        expect(receivedCtx).toBe(ctx);
    });

    it("from factory creates a condition with given name", () => {
        const condition = ConditionNode.from("myCondition", () => true);

        expect(condition.name).toBe("myCondition");
    });
});
