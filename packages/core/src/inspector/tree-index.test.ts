import { describe, it, expect } from "vitest";
import { NodeFlags, SerializableNode } from "../base/types";
import { TreeIndex } from "./tree-index";

function makeTree(): SerializableNode {
    return {
        id: 1,
        nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
        defaultName: "Root",
        name: "",
        tags: ["root-tag"],
        children: [
            {
                id: 2,
                nodeFlags: NodeFlags.Composite | NodeFlags.Selector,
                defaultName: "CombatSelector",
                name: "Combat",
                children: [
                    {
                        id: 3,
                        nodeFlags: NodeFlags.Decorator | NodeFlags.Guard,
                        defaultName: "ConditionDecorator",
                        name: "",
                        children: [
                            {
                                id: 4,
                                nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                                defaultName: "Attack",
                                name: "",
                                tags: ["combat", "damage"],
                            },
                        ],
                    },
                    {
                        id: 5,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Flee",
                        name: "",
                        tags: ["combat"],
                    },
                ],
            },
            {
                id: 6,
                nodeFlags: NodeFlags.Decorator | NodeFlags.Stateful | NodeFlags.SubTree,
                defaultName: "Throttle",
                name: "",
                children: [
                    {
                        id: 7,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Idle",
                        name: "",
                    },
                ],
            },
        ],
    };
}

describe("TreeIndex", () => {
    it("indexes all nodes by id", () => {
        const index = new TreeIndex(makeTree());
        expect(index.size).toBe(7);
        for (let id = 1; id <= 7; id++) {
            expect(index.getById(id)).toBeDefined();
        }
    });

    it("returns undefined for unknown id", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getById(999)).toBeUndefined();
    });

    it("stores correct depth for each node", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getById(1)!.depth).toBe(0);
        expect(index.getById(2)!.depth).toBe(1);
        expect(index.getById(3)!.depth).toBe(2);
        expect(index.getById(4)!.depth).toBe(3);
        expect(index.getById(6)!.depth).toBe(1);
        expect(index.getById(7)!.depth).toBe(2);
    });

    it("stores parent references", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getById(1)!.parentId).toBeUndefined();
        expect(index.getById(2)!.parentId).toBe(1);
        expect(index.getById(4)!.parentId).toBe(3);
        expect(index.getById(7)!.parentId).toBe(6);
    });

    it("stores children ids", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getById(1)!.childrenIds).toEqual([2, 6]);
        expect(index.getById(2)!.childrenIds).toEqual([3, 5]);
        expect(index.getById(4)!.childrenIds).toEqual([]);
    });

    it("pre-order traversal", () => {
        const index = new TreeIndex(makeTree());
        expect(index.preOrder).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("lookup by name uses name field when set, else defaultName", () => {
        const index = new TreeIndex(makeTree());
        // node 2 has name="Combat"
        expect(index.getByName("Combat")).toHaveLength(1);
        expect(index.getByName("Combat")[0].id).toBe(2);
        // node 4 has name="" so indexed by defaultName "Attack"
        expect(index.getByName("Attack")).toHaveLength(1);
        expect(index.getByName("Attack")[0].id).toBe(4);
        // no match
        expect(index.getByName("Nonexistent")).toHaveLength(0);
    });

    it("lookup by tag", () => {
        const index = new TreeIndex(makeTree());
        const combatNodes = index.getByTag("combat");
        expect(combatNodes).toHaveLength(2);
        expect(combatNodes.map(n => n.id).sort()).toEqual([4, 5]);

        expect(index.getByTag("damage")).toHaveLength(1);
        expect(index.getByTag("damage")[0].id).toBe(4);

        expect(index.getByTag("unknown")).toHaveLength(0);
    });

    it("lookup by flag", () => {
        const index = new TreeIndex(makeTree());
        const actions = index.getByFlag(NodeFlags.Action);
        expect(actions.map(n => n.id).sort()).toEqual([4, 5, 7]);
    });

    it("getLeaves, getComposites, getDecorators", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getLeaves().map(n => n.id).sort()).toEqual([4, 5, 7]);
        expect(index.getComposites().map(n => n.id).sort()).toEqual([1, 2]);
        expect(index.getDecorators().map(n => n.id).sort()).toEqual([3, 6]);
    });

    it("getSubTrees", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getSubTrees().map(n => n.id)).toEqual([6]);
    });

    it("getChildren returns indexed nodes", () => {
        const index = new TreeIndex(makeTree());
        const children = index.getChildren(2);
        expect(children.map(c => c.id)).toEqual([3, 5]);
    });

    it("getParent", () => {
        const index = new TreeIndex(makeTree());
        expect(index.getParent(4)?.id).toBe(3);
        expect(index.getParent(1)).toBeUndefined();
    });

    it("getAncestors returns from parent to root", () => {
        const index = new TreeIndex(makeTree());
        const ancestors = index.getAncestors(4);
        expect(ancestors.map(a => a.id)).toEqual([3, 2, 1]);
    });

    it("getDescendants returns all descendants in pre-order", () => {
        const index = new TreeIndex(makeTree());
        const descendants = index.getDescendants(2);
        expect(descendants.map(d => d.id)).toEqual([3, 4, 5]);
    });

    it("getAllTags returns unique tag names", () => {
        const index = new TreeIndex(makeTree());
        const tags = index.getAllTags().sort();
        expect(tags).toEqual(["combat", "damage", "root-tag"]);
    });

    it("getPathString returns breadcrumb path", () => {
        const index = new TreeIndex(makeTree());
        // node 4: Root > Combat > ConditionDecorator > Attack
        expect(index.getPathString(4)).toBe("Root > Combat > ConditionDecorator > Attack");
        // node 2 has name="Combat": Root > Combat
        expect(index.getPathString(2)).toBe("Root > Combat");
        // root
        expect(index.getPathString(1)).toBe("Root");
        // unknown
        expect(index.getPathString(999)).toBe("");
    });
});
