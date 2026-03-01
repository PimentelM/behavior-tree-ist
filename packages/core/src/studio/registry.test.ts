import { describe, expect, it } from "vitest";
import { BehaviourTree } from "../tree";
import { StubAction } from "../test-helpers";
import { NodeResult } from "../base/types";
import { BehaviourTreeRegistry } from "./registry";

describe("BehaviourTreeRegistry", () => {
    it("registers trees and emits ticks from onTickRecord", () => {
        const tree = new BehaviourTree(new StubAction(NodeResult.Succeeded));
        const registry = new BehaviourTreeRegistry();

        const seen: number[] = [];
        const offTick = registry.onTick((_treeKey, record) => {
            seen.push(record.tickId);
        });

        const { treeKey } = registry.registerTree(tree, { name: "Main" });
        tree.tick({ now: 1 });

        expect(registry.listTrees()).toEqual([
            {
                treeKey,
                treeId: tree.treeId,
                name: "Main",
                description: undefined,
            },
        ]);
        expect(seen).toEqual([1]);

        offTick();
    });

    it("unregisterTree calls the off function from tree.onTickRecord", () => {
        const tree = new BehaviourTree(new StubAction(NodeResult.Succeeded));
        const registry = new BehaviourTreeRegistry();
        const seen: number[] = [];

        const { treeKey } = registry.registerTree(tree, { name: "Main" });
        registry.onTick((_treeKey, record) => {
            seen.push(record.tickId);
        });

        tree.tick({ now: 1 });
        registry.unregisterTree(treeKey);
        tree.tick({ now: 2 });

        expect(seen).toEqual([1]);
    });
});
