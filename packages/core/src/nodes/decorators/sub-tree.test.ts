import { describe, expect, it } from "vitest";
import { BTNode, Decorator, NodeFlags, NodeResult } from "../../base";
import { createTickContext, StubAction } from "../../test-helpers";
import { SubTree } from "./sub-tree";
import { Inverter } from "./inverter";

describe("SubTree Decorator", () => {
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

    it("sets Decorator and SubTree flags", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded));

        expect(subTree.nodeFlags & NodeFlags.Decorator).toBeTruthy();
        expect(subTree.nodeFlags & NodeFlags.SubTree).toBeTruthy();
    });

    it("exposes metadata through display state", () => {
        const subTree = new SubTree(new StubAction(NodeResult.Succeeded), {
            id: "combat-root",
            namespace: "combat",
        });

        expect(subTree.getDisplayState?.()).toEqual({
            id: "combat-root",
            namespace: "combat",
        });
    });

    it("forwards .decorate calls to the child node and keeps SubTree in place", () => {
        const action = new StubAction(NodeResult.Succeeded);
        const subTree = new SubTree(action);

        // When applying a decorator to a SubTree
        const decorated = subTree.decorate([Inverter]);

        // Then it should return the same subTree instance
        expect(decorated).toBe(subTree);

        // And the child of the subTree should now be an Inverter
        expect(subTree.child).toBeInstanceOf(Inverter);
        expect((subTree.child as unknown as Decorator).child).toBe(action);

        // Verify the behavior is correctly applied (child should now return Failed)
        const result = BTNode.Tick(subTree, {
            tickId: 1,
            now: Date.now(),
            events: [],
            refEvents: [],
            isStateTraceEnabled: false,
            trace: () => { }
        });

        expect(result).toBe(NodeResult.Failed);
    });
});
