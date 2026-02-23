import { describe, it, expect } from "vitest";
import { BehaviourTree } from "./tree";
import { NodeResult } from "./base/types";
import { StubAction } from "./test-helpers";
import { Throttle, WaitAction } from "./nodes";
import { selector, sequence, condition, action } from "./builder";
import { Action } from "./base";

describe("BehaviourTree", () => {
    it("ticks root node", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);

        tree.tick({ now: 0 });

        expect(root.tickCount).toBe(1);
    });

    it("increments tickId each tick", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);
        tree.enableTrace();

        const events1 = tree.tick({ now: 0 });
        const events2 = tree.tick({ now: 100 });

        expect(events1[0].tickId).toBe(1);
        expect(events2[0].tickId).toBe(2);
    });

    it("uses provided tickNumber and now", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);
        tree.enableTrace();

        const events = tree.tick({ tickNumber: 42, now: 999 });

        expect(events[0].tickNumber).toBe(42);
        expect(events[0].timestampMs).toBe(999);
    });

    it("defaults tickNumber to tickId when not provided", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);
        tree.enableTrace();

        const events = tree.tick({ now: 0 });

        expect(events[0].tickNumber).toBe(1);
    });

    it("returns empty events when tracing disabled", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);

        const events = tree.tick({ now: 0 });

        expect(events).toEqual([]);
    });

    describe('tracing', () => {
        it("returns events when tracing enabled", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableTrace();

            const events = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].result).toBe(NodeResult.Succeeded);
        });

        it("trace events contain correct node metadata", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableTrace();

            const events = tree.tick({ now: 100 });

            expect(events[0]).toEqual({
                tickId: 1,
                tickNumber: 1,
                timestampMs: 100,
                nodeId: root.id,
                result: NodeResult.Succeeded,
            });
        });

        it("enableTrace and disableTrace support chaining", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);

            const result = tree.enableTrace().disableTrace();

            expect(result).toBe(tree);
        });


        it('should contain events for all and only nodes that were ticked', () => {
            const cond1 = condition({ name: "cond1", eval: () => false });
            const unreachable1 = action({ name: "unreachable1", execute: () => NodeResult.Succeeded });
            const seq1 = sequence({ name: "seq1" }, [cond1, unreachable1]);

            const cond2 = condition({ name: "cond2", eval: () => true });
            const act2 = action({ name: "act2", execute: () => NodeResult.Succeeded });
            const act3 = action({ name: "act3", execute: () => NodeResult.Failed });
            const unreachable2 = action({ name: "unreachable2", execute: () => NodeResult.Succeeded });
            const seq2 = sequence({ name: "seq2" }, [cond2, act2, act3, unreachable2]);

            const fallback1 = action({ name: "fallback1", execute: () => NodeResult.Succeeded });
            const root = selector({ name: "root" }, [seq1, seq2, fallback1]);

            const tree = new BehaviourTree(root).enableTrace();

            const events = tree.tick({ now: 0 });

            expect(events.map(e => [e.nodeId, e.result])).toEqual([
                [cond1.id, NodeResult.Failed],
                [seq1.id, NodeResult.Failed],
                [cond2.id, NodeResult.Succeeded],
                [act2.id, NodeResult.Succeeded],
                [act3.id, NodeResult.Failed],
                [seq2.id, NodeResult.Failed],
                [fallback1.id, NodeResult.Succeeded],
                [root.id, NodeResult.Succeeded],
            ]);
        })

        it('Should include trace for decorators in the trace events', () => {
            const isReady = condition({ name: "isReady", eval: () => true });
            const doSomething = action({ name: "doSomething", execute: () => NodeResult.Succeeded });
            const innerAction = Action.from("decoratedNode", () => NodeResult.Succeeded);
            const throttle = new Throttle(innerAction, 1000);
            const root = sequence({ name: "root" }, [isReady, doSomething, throttle]);
            const tree = new BehaviourTree(root).enableTrace();

            const events1 = tree.tick({ now: 1 });
            expect(events1.map(e => [e.nodeId, e.result])).toEqual([
                [isReady.id, NodeResult.Succeeded],
                [doSomething.id, NodeResult.Succeeded],
                [innerAction.id, NodeResult.Succeeded],
                [throttle.id, NodeResult.Succeeded],
                [root.id, NodeResult.Succeeded],
            ]);
            expect(events1.find(e => e.nodeId === throttle.id)?.state).toEqual({ remainingThrottleMs: 1000 });

            const events2 = tree.tick({ now: 2 });
            expect(events2.map(e => [e.nodeId, e.result])).toEqual([
                [isReady.id, NodeResult.Succeeded],
                [doSomething.id, NodeResult.Succeeded],
                [throttle.id, NodeResult.Failed],
                [root.id, NodeResult.Failed],
            ]);
            expect(events2.find(e => e.nodeId === throttle.id)?.state).toEqual({ remainingThrottleMs: 999 });
        })

        it('includes state in trace events for stateful nodes', () => {
            const wait = new WaitAction(500);
            const tree = new BehaviourTree(wait).enableTrace();

            const events1 = tree.tick({ now: 0 });
            expect(events1.find(e => e.nodeId === wait.id)?.state).toEqual({ remainingTimeMs: 500 });

            const events2 = tree.tick({ now: 200 });
            expect(events2.find(e => e.nodeId === wait.id)?.state).toEqual({ remainingTimeMs: 300 });
        });
    })
})
