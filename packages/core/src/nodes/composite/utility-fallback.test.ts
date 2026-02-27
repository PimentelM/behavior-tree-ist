import { describe, expect, it } from "vitest";
import { NodeResult } from "../../base/types";
import { UtilityFallback } from "./utility-fallback";
import { Utility } from "../decorators/utility";
import { StubAction, tickNode } from "../../test-helpers";
import { OnTicked } from "../decorators/on-ticked";


describe("UtilityFallback", () => {
    it("ticks nodes in order of highest score", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);
        const child3 = new StubAction(NodeResult.Succeeded);

        const fallback = UtilityFallback.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => 10),
            new Utility(new OnTicked(child2, () => order.push(2)), () => 5),
            new Utility(new OnTicked(child3, () => order.push(3)), () => 20)
        ]);

        const result = tickNode(fallback);
        expect(result).toBe(NodeResult.Succeeded);
        expect(order).toEqual([3]);

        const child4 = new StubAction(NodeResult.Failed);
        const child5 = new StubAction(NodeResult.Succeeded);
        const fallbackFail = UtilityFallback.from([
            new Utility(new OnTicked(child4, () => order.push(4)), () => 50),
            new Utility(new OnTicked(child5, () => order.push(5)), () => 40),
        ]);

        const resultFailFirst = tickNode(fallbackFail);
        expect(resultFailFirst).toBe(NodeResult.Succeeded);
        expect(order).toEqual([3, 4, 5]);
    });

    it("evaluates scores on every tick and aborts previously running children if they are preempted by a success/running", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Running);
        const child3 = new StubAction(NodeResult.Failed);

        let child1Score = 10;
        const child2Score = 20;
        let child3Score = 10;

        const fallback = UtilityFallback.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => child1Score),
            new Utility(new OnTicked(child2, () => order.push(2)), () => child2Score),
            new Utility(new OnTicked(child3, () => order.push(3)), () => child3Score)
        ]);

        const result1 = tickNode(fallback);
        expect(result1).toBe(NodeResult.Running);
        expect(order).toEqual([2]);

        // Make child 1 the most desirable now, but its score alone isn't enough, it has to succeed or run to preempt
        child1Score = 30;
        const result2 = tickNode(fallback);
        // We expect child 2 to be aborted because child 1 preempted it and returned Running
        expect(result2).toBe(NodeResult.Running);
        expect(order).toEqual([2, 1]);

        // Make child 3 the most desirable but it fails. Thus child 1 should still run.
        child3Score = 40;
        const result3 = tickNode(fallback);
        expect(result3).toBe(NodeResult.Running);
        expect(order).toEqual([2, 1, 3, 1]);
    });

    it("returns failed if all nodes fail", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);

        const fallback = UtilityFallback.from([
            new Utility(child1, () => 10),
            new Utility(child2, () => 20)
        ]);

        const result = tickNode(fallback);
        expect(result).toBe(NodeResult.Failed);
    });

    it("throws if there are no nodes", () => {
        const fallback = new UtilityFallback();
        expect(() => tickNode(fallback)).toThrow();
    });

    it("evaluates equal scores deterministically based on input order", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);
        const child3 = new StubAction(NodeResult.Succeeded);

        const fallback = UtilityFallback.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => 10),
            new Utility(new OnTicked(child2, () => order.push(2)), () => 10),
            new Utility(new OnTicked(child3, () => order.push(3)), () => 10)
        ]);

        const result = tickNode(fallback);
        expect(result).toBe(NodeResult.Succeeded);
        expect(order).toEqual([1, 2, 3]); // Tie break maintains ascending index order
    });

    describe("mutation protection", () => {
        it("addNode throws if child is not Utility", () => {
            const fallback = new UtilityFallback();
            expect(() => fallback.addNode(new StubAction() as unknown as Utility)).toThrow(/only accepts Utility nodes/);
        });

        it("setNodes throws if a child is not Utility", () => {
            const fallback = new UtilityFallback();
            expect(() => fallback.setNodes([new StubAction() as unknown as Utility])).toThrow(/only accepts Utility nodes/);
        });

        it("setNodes still works after construction", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Succeeded);
            const fallback = UtilityFallback.from([
                new Utility(child1, () => 1)
            ]);

            fallback.setNodes([
                new Utility(child2, () => 2)
            ]);

            // Replaced!
            expect(fallback.getChildren()?.length).toBe(1);
        });
    });
});
