import { describe, expect, it } from "vitest";
import { BTNode, NodeFlags, NodeResult } from "../../base";
import { createTickContext, StubAction } from "../../test-helpers";
import { SubTree } from "./sub-tree";

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
});
