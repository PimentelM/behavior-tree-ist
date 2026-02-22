import { describe, it, expect } from "vitest";
import { BehaviourTree } from "./tree";
import { NodeResult } from "./base/types";
import { StubAction } from "./test-helpers";
import { Throttle } from "./nodes";
import { buildSubtree } from "./subtree-builder";
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
                nodeType: "Action",
                nodeDisplayName: "StubAction",
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
            const subtree = buildSubtree([
                "selector", "root",
                ["sequence", "seq1",
                    ["condition", "cond1", () => false],
                    ["action", "unreachable1", () => NodeResult.Succeeded],
                ],
                ["sequence", "seq2",
                    ["condition", "cond2", () => true],
                    ["action", "act2", () => NodeResult.Succeeded],
                    ["action", "act3", () => NodeResult.Failed],
                    ["action", "unreachable2", () => NodeResult.Succeeded]
                ],
                ["action", "fallback1", () => NodeResult.Succeeded]
            ])
            const tree = new BehaviourTree(subtree).enableTrace();

            const events = tree.tick({ now: 0 });

            expect(events.map(e => [e.nodeDisplayName, e.result])).toEqual([
                ["cond1", NodeResult.Failed],
                ["seq1", NodeResult.Failed],
                ["cond2", NodeResult.Succeeded],
                ["act2", NodeResult.Succeeded],
                ["act3", NodeResult.Failed],
                ["seq2", NodeResult.Failed],
                ["fallback1", NodeResult.Succeeded],
                ["root", NodeResult.Succeeded],
            ])
        })

        it('Should include trace for decorators in the trace events', () => {
            const decoratedNode = Action.from("decoratedNode", () => NodeResult.Succeeded)
                .decorate([Throttle, 1000])
            const subtree = buildSubtree([
                "sequence", "root",
                ["condition", "isReady", () => true],
                ["action", "doSomething", () => NodeResult.Succeeded],
                decoratedNode
            ]);
            const tree = new BehaviourTree(subtree).enableTrace();

            const events1 = tree.tick({ now: 1 });
            expect(events1.map(e => [e.nodeDisplayName, e.result, e.nodeType])).toEqual([
                ["isReady", NodeResult.Succeeded, "Condition"],
                ["doSomething", NodeResult.Succeeded, "Action"],
                ["decoratedNode", NodeResult.Succeeded, "Action"],
                ["Throttle (1000ms)", NodeResult.Succeeded, "Decorator"],
                ["root", NodeResult.Succeeded, "Sequence"],
            ])

            const events2 = tree.tick({ now: 2 });
            expect(events2.map(e => [e.nodeDisplayName, e.result, e.nodeType])).toEqual([
                ["isReady", NodeResult.Succeeded, "Condition"],
                ["doSomething", NodeResult.Succeeded, "Action"],
                ["Throttle (999ms)", NodeResult.Failed, "Decorator"],
                ["root", NodeResult.Failed, "Sequence"],
            ])
        })
    })
})
