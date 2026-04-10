import { describe, it, expect } from "vitest";
import { SkipIf } from "./skip-if";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, createNodeTicker, StubAction } from "../../test-helpers";

describe("SkipIf decorator", () => {
    it("returns Skipped when condition is true", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new SkipIf(child, "check", () => true);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Skipped);
    });

    it("aborts child when condition is true", () => {
        let conditionValue = false;
        const child = new StubAction(NodeResult.Running);
        const decorator = new SkipIf(child, "check", () => conditionValue);
        const ticker = createNodeTicker();

        ticker.tick(decorator);
        expect(child.abortCount).toBe(0);

        conditionValue = true;
        const result = ticker.tick(decorator);

        expect(result).toBe(NodeResult.Skipped);
        expect(child.abortCount).toBe(1);
    });

    it("ticks child when condition is false", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new SkipIf(child, "check", () => false);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("passes through child Succeeded when condition is false", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new SkipIf(child, "check", () => false);

        expect(BTNode.Tick(decorator, createTickContext())).toBe(NodeResult.Succeeded);
    });

    it("passes through child Failed when condition is false", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new SkipIf(child, "check", () => false);

        expect(BTNode.Tick(decorator, createTickContext())).toBe(NodeResult.Failed);
    });

    it("passes through child Running when condition is false", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new SkipIf(child, "check", () => false);

        expect(BTNode.Tick(decorator, createTickContext())).toBe(NodeResult.Running);
    });
});
