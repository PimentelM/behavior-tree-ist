import { describe, expect, it } from "vitest";
import { BTNode, type Decorator, NodeFlags, NodeResult } from "../../base";
import { createTickContext, StubAction } from "../../test-helpers";
import { SubTree } from "./sub-tree";
import { Inverter } from "../nodes/decorators/inverter";

describe("SubTree", () => {
    it("ticks the child node and returns its result", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        const result = BTNode.Tick(subTree, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(action.tickCount).toBe(1);
    });

    it("forwards abort to the child node", () => {
        const action = new StubAction(NodeResult.Running);
        const subTree = new SubTree(action);

        BTNode.Tick(subTree, createTickContext());
        BTNode.Abort(subTree, createTickContext());

        expect(action.abortCount).toBe(1);
    });

    it("sets SubTree flag only — no Decorator flag", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded));

        expect(subTree.nodeFlags & NodeFlags.SubTree).toBeTruthy();
        expect(subTree.nodeFlags & NodeFlags.Decorator).toBeFalsy();
    });

    it("exposes metadata through immutable node metadata", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded), {
            id: "combat-root",
            namespace: "combat",
        });

        expect(subTree.metadata).toEqual({
            id: "combat-root",
            namespace: "combat",
        });
        expect(subTree.getDisplayState?.()).toBeUndefined();
    });

    it("getChildren returns [child]", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        expect(subTree.getChildren()).toEqual([action]);
    });

    it(".decorate() wraps SubTree from outside, returning new outer decorator", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        const decorated = subTree.decorate([Inverter]);

        // decorate() returns the outer Inverter, not the SubTree
        expect(decorated).toBeInstanceOf(Inverter);
        expect((decorated as unknown as Decorator).child).toBe(subTree);
        expect(subTree.child).toBe(action);

        // Inverter wraps SubTree: result should be inverted
        const result = BTNode.Tick(decorated, createTickContext());
        expect(result).toBe(NodeResult.Failed);
    });

    it("stacks multiple decorators outside SubTree", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        const decorated = subTree.decorate([Inverter], [Inverter]);

        // Two inverters: Inverter → Inverter → SubTree → action
        expect(decorated).toBeInstanceOf(Inverter);
        const result = BTNode.Tick(decorated, createTickContext());
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("addTags stores tags on SubTree, not on child", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        subTree.addTags(["combat", "priority"]);

        expect(subTree.tags).toContain("combat");
        expect(subTree.tags).toContain("priority");
        expect(action.tags).toHaveLength(0);
    });

    it("tags getter returns own tags (not empty array)", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded));

        expect(subTree.tags).toEqual([]);

        subTree.addTags(["foo"]);

        expect(subTree.tags).toEqual(["foo"]);
    });

    it("setActivity stores activity on SubTree, not on child", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        subTree.setActivity("patrolling");

        expect(subTree.activity).toBe("patrolling");
        expect(action.activity).toBeUndefined();
    });

    it("activity getter returns own activity (not undefined by default after set)", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded));

        expect(subTree.activity).toBeUndefined();

        subTree.setActivity(true);

        expect(subTree.activity).toBe(true);
    });

    it("setActivity normalizes whitespace-only string to undefined", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded));

        subTree.setActivity("   ");

        expect(subTree.activity).toBeUndefined();
    });
});
