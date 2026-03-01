import { describe, expect, it } from "vitest";
import { NodeFlags, NodeResult, SerializableNode, TickRecord } from "../base/types";
import { createActivityProjector, projectActivity } from "./projector";

function makeTree(): SerializableNode {
    return {
        id: 1,
        nodeFlags: NodeFlags.Composite | NodeFlags.Parallel,
        defaultName: "Parallel",
        name: "Hunting",
        activity: "Hunting",
        children: [
            {
                id: 2,
                nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
                defaultName: "Sequence",
                name: "Attack",
                activity: "Targeting",
                children: [
                    {
                        id: 3,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Condition,
                        defaultName: "HasTarget",
                        name: "",
                    },
                    {
                        id: 4,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Attack",
                        name: "",
                        activity: "Attacking",
                    },
                ],
            },
            {
                id: 5,
                nodeFlags: NodeFlags.Composite | NodeFlags.Fallback,
                defaultName: "Fallback",
                name: "Movement",
                activity: "Movement",
                children: [
                    {
                        id: 6,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Kite",
                        name: "",
                        activity: "Kiting",
                    },
                    {
                        id: 7,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Patrol",
                        name: "",
                        activity: "Patrol",
                    },
                ],
            },
        ],
    };
}

function makeTickRecord(): TickRecord {
    return {
        tickId: 12,
        timestamp: 12000,
        refEvents: [],
        events: [
            { nodeId: 3, result: NodeResult.Succeeded },
            { nodeId: 4, result: NodeResult.Succeeded },
            { nodeId: 2, result: NodeResult.Succeeded },
            { nodeId: 6, result: NodeResult.Running },
            { nodeId: 5, result: NodeResult.Running },
            { nodeId: 1, result: NodeResult.Running },
        ],
    };
}

describe("activity projector", () => {
    it("projects parallel branches using activity labels", () => {
        const snapshot = projectActivity(makeTree(), makeTickRecord(), { mode: "all" });
        expect(snapshot.tickId).toBe(12);
        expect(snapshot.branches.map((branch) => branch.labels.join(" > "))).toEqual([
            "Hunting > Movement > Kiting",
            "Hunting > Targeting > Attacking",
        ]);
        expect(snapshot.branches[0].tailNodeId).toBe(6);
        expect(snapshot.branches[0].tailResult).toBe(NodeResult.Running);
        expect(snapshot.branches[1].tailNodeId).toBe(4);
        expect(snapshot.branches[1].tailResult).toBe(NodeResult.Succeeded);
    });

    it("filters by running mode", () => {
        const projector = createActivityProjector(makeTree());
        const snapshot = projector.project(makeTickRecord(), { mode: "running" });
        expect(snapshot.branches).toHaveLength(1);
        expect(snapshot.branches[0].labels).toEqual(["Hunting", "Movement", "Kiting"]);
        expect(snapshot.branches[0].tailResult).toBe(NodeResult.Running);
    });

    it("returns empty when root was not ticked", () => {
        const projector = createActivityProjector(makeTree());
        const snapshot = projector.project({
            tickId: 3,
            timestamp: 3000,
            refEvents: [],
            events: [{ nodeId: 4, result: NodeResult.Running }],
        });
        expect(snapshot.branches).toEqual([]);
    });

    it("dedupes entries by tail activity node and uses tail result", () => {
        const tree: SerializableNode = {
            id: 1,
            nodeFlags: NodeFlags.Composite | NodeFlags.Parallel,
            defaultName: "Root",
            name: "Root",
            activity: "Guarding",
            children: [
                {
                    id: 2,
                    nodeFlags: NodeFlags.Composite | NodeFlags.Parallel,
                    defaultName: "Parallel",
                    name: "DiagnosticsParallel",
                    activity: "Diagnostics Loop",
                    children: [
                        {
                            id: 3,
                            nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                            defaultName: "AlwaysRunning",
                            name: "AlwaysRunning",
                        },
                        {
                            id: 4,
                            nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                            defaultName: "ResultsTransformersShowcase",
                            name: "ResultsTransformersShowcase",
                        },
                    ],
                },
            ],
        };

        const snapshot = projectActivity(tree, {
            tickId: 7,
            timestamp: 7000,
            refEvents: [],
            events: [
                { nodeId: 3, result: NodeResult.Running },
                { nodeId: 4, result: NodeResult.Succeeded },
                { nodeId: 2, result: NodeResult.Running },
                { nodeId: 1, result: NodeResult.Running },
            ],
        }, { mode: "all" });

        expect(snapshot.branches).toHaveLength(1);
        expect(snapshot.branches[0].labels).toEqual(["Guarding", "Diagnostics Loop"]);
        expect(snapshot.branches[0].tailNodeId).toBe(2);
        expect(snapshot.branches[0].tailResult).toBe(NodeResult.Running);
        expect(snapshot.branches[0].pathNodeIds).toEqual([1, 2]);
    });

    it("uses node name or defaultName when activity metadata is true", () => {
        const tree: SerializableNode = {
            id: 1,
            nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
            defaultName: "RootSequence",
            name: "",
            activity: true,
            children: [
                {
                    id: 2,
                    nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                    defaultName: "PatrolAction",
                    name: "Patrolling",
                    activity: true,
                },
            ],
        };

        const snapshot = projectActivity(tree, {
            tickId: 1,
            timestamp: 1000,
            refEvents: [],
            events: [
                { nodeId: 2, result: NodeResult.Running },
                { nodeId: 1, result: NodeResult.Running },
            ],
        }, { mode: "running" });

        expect(snapshot.branches).toHaveLength(1);
        expect(snapshot.branches[0].labels).toEqual(["RootSequence", "Patrolling"]);
        expect(snapshot.branches[0].tailNodeId).toBe(2);
        expect(snapshot.branches[0].tailResult).toBe(NodeResult.Running);
    });
});
