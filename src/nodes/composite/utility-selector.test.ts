import { describe, it, expect } from "vitest";
import { UtilitySelector } from "./utility-selector";
import { NodeResult } from "../../base";
import { StubAction, tickNode } from "../../test-helpers";

describe("UtilitySelector", () => {
    it("ticks nodes in order of highest score", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Failed);

        const selector = UtilitySelector.from([
            { node: child1, scorer: () => 10 },
            { node: child2, scorer: () => 5 },
            { node: child3, scorer: () => 50 } // Highest, but will return Failed initially (so we fall to next)
        ]);
        const result = tickNode(selector);

        expect(result).toBe(NodeResult.Succeeded);
        expect(child3.tickCount).toBe(1); // Checked first, failed
        expect(child1.tickCount).toBe(1); // Checked second, failed
        expect(child2.tickCount).toBe(1); // Checked third, succeeded
    });

    it("evaluates scores on every tick and aborts previously running children if a higher utility one preempts it", () => {
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Running);
        let child1Score = 50;
        let child2Score = 10;

        const selector = UtilitySelector.from([
            { node: child1, scorer: () => child1Score },
            { node: child2, scorer: () => child2Score }
        ]);
        tickNode(selector); // child1 has 50, so it runs

        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(0);

        // Dynamically change score so child2 becomes highest priority and preempts child1
        child1Score = 0;
        child2Score = 20;
        tickNode(selector);

        expect(child2.tickCount).toBe(1); // Now child2 runs
        expect(child1.tickCount).toBe(1); // child1 was not ticked this time
        expect(child1.abortCount).toBe(1); // child1 should be aborted since it was running and got preempted
    });

    it("returns failed if all nodes fail", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);

        const selector = UtilitySelector.from([
            { node: child1, scorer: () => 10 },
            { node: child2, scorer: () => 20 }
        ]);
        const result = tickNode(selector);

        expect(result).toBe(NodeResult.Failed);
        expect(child2.tickCount).toBe(1);
        expect(child1.tickCount).toBe(1);
    });

    it("throws if there are no nodes", () => {
        const selector = UtilitySelector.from([]);
        expect(() => tickNode(selector)).toThrow();
    });
});
