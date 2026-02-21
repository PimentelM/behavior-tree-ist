import { describe, it, expect } from "vitest";
import { Retry } from "./retry";
import { NodeResult } from "../../base";
import { StubAction, tickNode } from "../../test-helpers";

describe("Retry", () => {
    it("retries failed child n times and returns Running during", () => {
        const child = new StubAction(NodeResult.Failed);
        const retry = new Retry(child, 2);

        const result1 = tickNode(retry);
        expect(result1).toBe(NodeResult.Running); // 1st failure hidden
        expect(child.tickCount).toBe(1);

        const result2 = tickNode(retry);
        expect(result2).toBe(NodeResult.Running); // 2nd failure hidden
        expect(child.tickCount).toBe(2);

        const result3 = tickNode(retry);
        expect(result3).toBe(NodeResult.Failed); // 3rd failure passes through (0, 1, 2)
        expect(child.tickCount).toBe(3);
    });

    it("succeeds immediately if child succeeds", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const retry = new Retry(child, 3);

        const result = tickNode(retry);
        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("passes through running state", () => {
        const child = new StubAction(NodeResult.Running);
        const retry = new Retry(child, 3);

        const result = tickNode(retry);
        expect(result).toBe(NodeResult.Running);
    });

    it("retries infinitely if maxRetries is -1", () => {
        const child = new StubAction(NodeResult.Failed);
        const retry = new Retry(child, -1);

        for (let i = 0; i < 10; i++) {
            const result = tickNode(retry);
            expect(result).toBe(NodeResult.Running);
        }

        expect(child.tickCount).toBe(10);
    });
});
