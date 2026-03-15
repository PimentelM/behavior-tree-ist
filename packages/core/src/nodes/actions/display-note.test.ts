import { describe, it, expect } from "vitest";
import { DisplayNote } from "./display-note";
import { NodeResult, NodeFlags } from "../../base/types";
import { createTickContext, tickNode } from "../../test-helpers";

describe("DisplayNote", () => {
    it("has the Display and Action flags", () => {
        const node = new DisplayNote("Test", "hello");
        expect(node.nodeFlags & NodeFlags.Display).toBeTruthy();
        expect(node.nodeFlags & NodeFlags.Action).toBeTruthy();
    });

    it("returns Succeeded on tick", () => {
        const node = new DisplayNote("Test", "hello");
        const ctx = createTickContext();
        const result = tickNode(node, ctx);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns note text as display state", () => {
        const node = new DisplayNote("Test", "my annotation");
        const state = node.getDisplayState();
        expect(state).toEqual({ note: "my annotation" });
    });

    it("preserves empty string text", () => {
        const node = new DisplayNote("Test", "");
        expect(node.getDisplayState()).toEqual({ note: "" });
    });
});
