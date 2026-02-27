import { describe, it, expect } from "vitest";
import { DisplayState } from "./display-state";
import { NodeResult, NodeFlags } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("DisplayState", () => {
    it("has the Display and Action flags", () => {
        const node = new DisplayState("Test", () => ({}));
        expect(node.nodeFlags & NodeFlags.Display).toBeTruthy();
        expect(node.nodeFlags & NodeFlags.Action).toBeTruthy();
    });

    it("returns Succeeded on tick", () => {
        const node = new DisplayState("Test", () => ({}));
        const ctx = createTickContext();
        // @ts-ignore
        const result = node.onTick(ctx);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns computed state from displayFn", () => {
        const node = new DisplayState("Test", () => ({ foo: "bar" }));
        const state = node.getDisplayState();
        expect(state).toEqual({ foo: "bar" });
    });
});
