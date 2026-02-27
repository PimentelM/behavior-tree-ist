import { describe, it, expect } from "vitest";
import { Repeat } from "./repeat";
import { NodeResult } from "../../base";
import { StubAction, tickNode } from "../../test-helpers";

describe("Repeat", () => {
    it("repeats successful child n times and returns Running during", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const repeat = new Repeat(child, 3);

        const result1 = tickNode(repeat);
        expect(result1).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(1);
        // Child completed naturally (never was Running), so abort is a no-op
        // State reset happens via onReset when transitioning out of Running
        expect(child.abortCount).toBe(0);

        const result2 = tickNode(repeat);
        expect(result2).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(2);

        const result3 = tickNode(repeat);
        expect(result3).toBe(NodeResult.Succeeded); // 3rd success triggers parent success
        expect(child.tickCount).toBe(3);

        // Next tick should start a new repeat cycle
        const result4 = tickNode(repeat);
        expect(result4).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(4); // Child is ticked again for the new cycle
    });

    it("fails immediately if child fails", () => {
        const child = new StubAction(NodeResult.Failed);
        const repeat = new Repeat(child, 3);

        const result = tickNode(repeat);
        expect(result).toBe(NodeResult.Failed);
    });

    it("passes through running state", () => {
        const child = new StubAction(NodeResult.Running);
        const repeat = new Repeat(child, 3);

        const result = tickNode(repeat);
        expect(result).toBe(NodeResult.Running);
        expect(child.abortCount).toBe(0);
    });

    it("repeats infinitely if times is -1", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const repeat = new Repeat(child, -1);

        for (let i = 0; i < 10; i++) {
            const result = tickNode(repeat);
            expect(result).toBe(NodeResult.Running);
        }

        expect(child.tickCount).toBe(10);
    });
});
