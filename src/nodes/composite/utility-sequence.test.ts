import { describe, expect, it } from "vitest";
import { NodeResult } from "../../base/types";
import { UtilitySequence } from "./utility-sequence";
import { Utility } from "../decorators/utility";
import { StubAction, tickNode } from "../../test-helpers";
import { OnTicked } from "../decorators/on-ticked";

describe("UtilitySequence", () => {
    it("ticks nodes in order of highest score", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Succeeded);

        const sequence = UtilitySequence.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => 10),
            new Utility(new OnTicked(child2, () => order.push(2)), () => 5),
            new Utility(new OnTicked(child3, () => order.push(3)), () => 20)
        ]);

        const result = tickNode(sequence);
        expect(result).toBe(NodeResult.Succeeded);
        expect(order).toEqual([3, 1, 2]);

        const child4 = new StubAction(NodeResult.Failed);
        const child5 = new StubAction(NodeResult.Succeeded);
        const sequenceFail = UtilitySequence.from([
            new Utility(new OnTicked(child4, () => order.push(4)), () => 50),
            new Utility(new OnTicked(child5, () => order.push(5)), () => 40),
        ]);

        const resultFailFirst = tickNode(sequenceFail);
        expect(resultFailFirst).toBe(NodeResult.Failed);
        expect(order).toEqual([3, 1, 2, 4]); // 5 is never ticked because 4 failed
    });

    it("evaluates scores on every tick and aborts previously running children if they are preempted by a failure/running", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Running);
        const child3 = new StubAction(NodeResult.Succeeded);

        let child1Score = 10;
        const child2Score = 20;
        let child3Score = 10;

        const sequence = UtilitySequence.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => child1Score),
            new Utility(new OnTicked(child2, () => order.push(2)), () => child2Score),
            new Utility(new OnTicked(child3, () => order.push(3)), () => child3Score)
        ]);

        const result1 = tickNode(sequence);
        // Child 2 has the highest score (20), so it ticks first and returns Running.
        // The sequence stops there and returns Running.
        expect(result1).toBe(NodeResult.Running);
        expect(order).toEqual([2]);


        // Make child 1 the most desirable now.
        child1Score = 30;
        const result2 = tickNode(sequence);
        // Child 1 is scored 30, ticks, returns Running. Preempts 2.
        // We expect child 2 to be aborted because child 1 preempted it and returned Running
        expect(result2).toBe(NodeResult.Running);
        expect(order).toEqual([2, 1]);

        // Make child 3 the most desirable and it succeeds. Thus child 1 should tick next.
        child3Score = 40;
        const result3 = tickNode(sequence);
        // It evaluated 3 (succeeded), then evaluated 1 (running). Thus 1 is still the currently running node.
        expect(result3).toBe(NodeResult.Running);
        expect(order).toEqual([2, 1, 3, 1]);
    });

    it("returns succeeded if all nodes succeed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);

        const sequence = UtilitySequence.from([
            new Utility(child1, () => 10),
            new Utility(child2, () => 20)
        ]);

        const result = tickNode(sequence);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("throws if there are no nodes", () => {
        const sequence = new UtilitySequence();
        expect(() => tickNode(sequence)).toThrow();
    });

    it("evaluates equal scores deterministically based on input order", () => {
        const order: number[] = [];
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Succeeded);

        const sequence = UtilitySequence.from([
            new Utility(new OnTicked(child1, () => order.push(1)), () => 10),
            new Utility(new OnTicked(child2, () => order.push(2)), () => 10),
            new Utility(new OnTicked(child3, () => order.push(3)), () => 10)
        ]);

        const result = tickNode(sequence);
        expect(result).toBe(NodeResult.Succeeded);
        expect(order).toEqual([1, 2, 3]); // Tie break maintains ascending index order
    });

    describe("mutation protection", () => {
        it("addNode throws if child is not Utility", () => {
            const sequence = new UtilitySequence();
            expect(() => sequence.addNode(new StubAction() as unknown as Utility)).toThrow(/only accepts Utility nodes/);
        });

        it("setNodes throws if a child is not Utility", () => {
            const sequence = new UtilitySequence();
            expect(() => sequence.setNodes([new StubAction() as unknown as Utility])).toThrow(/only accepts Utility nodes/);
        });

        it("setNodes works after construction", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Succeeded);
            const sequence = UtilitySequence.from([
                new Utility(child1, () => 1)
            ]);

            sequence.setNodes([
                new Utility(child2, () => 2)
            ]);

            // Replaced!
            expect(sequence.getChildren()?.length).toBe(1);
        });
    });
});
