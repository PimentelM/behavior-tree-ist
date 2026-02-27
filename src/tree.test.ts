import { describe, it, expect } from "vitest";
import { BehaviourTree } from "./tree";
import { NodeResult } from "./base/types";
import { StubAction } from "./test-helpers";
import { Throttle, Sleep } from "./nodes";
import { fallback, sequence, condition, action } from "./builder";
import { Action, AsyncAction, ref } from "./base";

describe("BehaviourTree", () => {
    it("ticks root node", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);

        tree.tick({ now: 0 });

        expect(root.tickCount).toBe(1);
    });

    it("throws an error if a node is attached to multiple parents", () => {
        const sharedAction = action({ name: "shared", execute: () => NodeResult.Succeeded });
        sequence({ name: "seq1" }, [sharedAction]);
        expect(() => sequence({ name: "seq2" }, [sharedAction])).toThrow(/Node shared \(id: \d+\) already has a parent \(seq1\). Nodes cannot be shared between multiple parents./);
    });

    it("increments tickId each tick", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);
        tree.enableTrace();

        const tick1 = tree.tick({ now: 0 });
        const tick2 = tree.tick({ now: 100 });

        expect(tick1.tickId).toBe(1);
        expect(tick2.tickId).toBe(2);
    });

    it("uses provided now", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);
        tree.enableTrace();

        const tick = tree.tick({ now: 999 });

        expect(tick.timestamp).toBe(999);
    });

    it("returns empty events when tracing disabled", () => {
        const root = new StubAction(NodeResult.Succeeded);
        const tree = new BehaviourTree(root);

        const { events } = tree.tick({ now: 0 });

        expect(events).toEqual([]);
    });

    describe('tracing', () => {
        it("returns events when tracing enabled", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableTrace();

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].result).toBe(NodeResult.Succeeded);
        });

        it("trace events contain correct node metadata", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableTrace();

            const { events } = tree.tick({ now: 100 });

            expect(events[0]).toEqual({
                tickId: 1,
                timestamp: 100,
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
            const root = fallback({ name: "root" }, [seq1, seq2, fallback1]);

            const tree = new BehaviourTree(root).enableTrace();

            const { events } = tree.tick({ now: 0 });

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

            const { events: events1 } = tree.tick({ now: 1 });
            expect(events1.map(e => [e.nodeId, e.result])).toEqual([
                [isReady.id, NodeResult.Succeeded],
                [doSomething.id, NodeResult.Succeeded],
                [innerAction.id, NodeResult.Succeeded],
                [throttle.id, NodeResult.Succeeded],
                [root.id, NodeResult.Succeeded],
            ]);
            expect(events1.find(e => e.nodeId === throttle.id)?.state).toEqual({ remainingThrottle: 1000 });

            const { events: events2 } = tree.tick({ now: 2 });
            expect(events2.map(e => [e.nodeId, e.result])).toEqual([
                [isReady.id, NodeResult.Succeeded],
                [doSomething.id, NodeResult.Succeeded],
                [throttle.id, NodeResult.Failed],
                [root.id, NodeResult.Failed],
            ]);
            expect(events2.find(e => e.nodeId === throttle.id)?.state).toEqual({ remainingThrottle: 999 });
        })

        it('includes state in trace events for stateful nodes', () => {
            const wait = new Sleep(500);
            const tree = new BehaviourTree(wait).enableTrace();

            const { events: events1 } = tree.tick({ now: 0 });
            expect(events1.find(e => e.nodeId === wait.id)?.state).toEqual({ remainingTime: 500 });

            const { events: events2 } = tree.tick({ now: 200 });
            expect(events2.find(e => e.nodeId === wait.id)?.state).toEqual({ remainingTime: 300 });
        });
    })

    describe('refEvents', () => {
        it("tick() returns refEvents in TickRecord", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root).enableTrace();

            const record = tree.tick({ now: 0 });

            expect(record.refEvents).toEqual([]);
        });

        it("ref writes during tick appear in returned refEvents", () => {
            const counter = ref(0, "counter");
            const root = Action.from("inc", () => {
                counter.value = 1;
                return NodeResult.Succeeded;
            });
            const tree = new BehaviourTree(root).enableTrace();

            const record = tree.tick({ now: 100 });

            expect(record.refEvents).toHaveLength(1);
            expect(record.refEvents[0]).toEqual({
                tickId: 1,
                timestamp: 100,
                refName: "counter",
                newValue: 1,
                isAsync: false,
            });
        });

        it("empty refEvents when no refs written", () => {
            const _unused = ref(0, "unused");
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root).enableTrace();

            const record = tree.tick({ now: 0 });

            expect(record.refEvents).toEqual([]);
        });

        it('should not produce refEvents when mutating a ref to the same value it already has', () => {
            const myNumber = ref(123, "wow");
            const root = Action.from("inc", () => {
                myNumber.value = 123;
                return NodeResult.Succeeded;
            });
            const tree = new BehaviourTree(root).enableTrace();

            const record = tree.tick({ now: 100 });

            expect(record.refEvents).toHaveLength(0);
        })

        describe("AsyncAction Trace Recording", () => {
            it("mutations to shared Refs during AsyncAction should be recorded in the trace", async () => {
                const sharedRef = ref(0, "shared");

                const asyncNode = AsyncAction.from("test", async (ctx) => {
                    // Simulation of async work
                    // @ts-expect-error setTimeout is not defined in this context
                    await new Promise(resolve => setTimeout(resolve, 10));
                    sharedRef.set(1, ctx);
                    return NodeResult.Succeeded;
                });

                const tree = new BehaviourTree(asyncNode).enableTrace();

                // Tick 1: Starts the async action
                const tick1 = tree.tick();
                expect(tick1.refEvents).toHaveLength(0);

                // Wait for async work to complete
                // @ts-expect-error setTimeout is not defined in this context
                await new Promise(resolve => setTimeout(resolve, 30));

                // Tick 2: Collects the result
                const tick2 = tree.tick();

                // The mutation happened after Tick 1 finished, but before Tick 2 started.
                // It should be picked up by Tick 2.
                expect(tick2.refEvents).toContainEqual(expect.objectContaining({
                    refName: "shared",
                    newValue: 1,
                    isAsync: true
                }));
            });
        });

    });

    describe('profiling', () => {
        it("includes startedAt/finishedAt when profiling enabled", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            let clock = 0;
            tree.enableProfiling(() => clock++);

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].startedAt).toBeDefined();
            expect(events[0].finishedAt).toBeDefined();
        });

        it("enableProfiling implicitly enables tracing", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableProfiling(() => 0);

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
        });

        it("disableProfiling stops profiling data but keeps tracing", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableProfiling(() => 0);
            tree.disableProfiling();

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].startedAt).toBeUndefined();
            expect(events[0].finishedAt).toBeUndefined();
        });

        it("disableTrace also disables profiling", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableProfiling(() => 0);
            tree.disableTrace();

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(0);
        });

        it("re-enabling trace after disableTrace does not restore profiling", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableProfiling(() => 0);
            tree.disableTrace();
            tree.enableTrace();

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].startedAt).toBeUndefined();
            expect(events[0].finishedAt).toBeUndefined();
        });

        it("nested node timing: parent startedAt < child startedAt, parent finishedAt > child finishedAt", () => {
            const child = new StubAction(NodeResult.Succeeded);
            const root = sequence({ name: "root" }, [child]);
            const tree = new BehaviourTree(root);
            let clock = 0;
            tree.enableProfiling(() => clock++);

            const { events } = tree.tick({ now: 0 });

            const childEvent = events.find(e => e.nodeId === child.id)!;
            const rootEvent = events.find(e => e.nodeId === root.id)!;

            expect(rootEvent.startedAt).toBeDefined();
            expect(rootEvent.finishedAt).toBeDefined();
            expect(childEvent.startedAt).toBeDefined();
            expect(childEvent.finishedAt).toBeDefined();
            expect(rootEvent.startedAt!).toBeLessThan(childEvent.startedAt!);
            expect(rootEvent.finishedAt!).toBeGreaterThan(childEvent.finishedAt!);
        });

        it("no startedAt/finishedAt when only tracing (no profiling)", () => {
            const root = new StubAction(NodeResult.Succeeded);
            const tree = new BehaviourTree(root);
            tree.enableTrace();

            const { events } = tree.tick({ now: 0 });

            expect(events).toHaveLength(1);
            expect(events[0].startedAt).toBeUndefined();
            expect(events[0].finishedAt).toBeUndefined();
        });
    })
})
