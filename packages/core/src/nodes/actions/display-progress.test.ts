import { describe, it, expect } from "vitest";
import { DisplayProgress } from "./display-progress";
import { NodeResult, NodeFlags } from "../../base/types";
import { createTickContext, tickNode } from "../../test-helpers";

describe("DisplayProgress", () => {
    it("has the Display and Action flags", () => {
        const node = new DisplayProgress("Test", () => ({ progress: 0.5 }));
        expect(node.nodeFlags & NodeFlags.Display).toBeTruthy();
        expect(node.nodeFlags & NodeFlags.Action).toBeTruthy();
    });

    it("returns Succeeded on tick", () => {
        const node = new DisplayProgress("Test", () => ({ progress: 0.5 }));
        const ctx = createTickContext();
        const result = tickNode(node, ctx);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns progress without label", () => {
        const node = new DisplayProgress("Test", () => ({ progress: 0.75 }));
        expect(node.getDisplayState()).toEqual({ progress: 0.75 });
    });

    it("returns progress with label", () => {
        const node = new DisplayProgress("Test", () => ({ progress: 0.3, label: "Loading" }));
        expect(node.getDisplayState()).toEqual({ progress: 0.3, label: "Loading" });
    });

    it("reflects live progress updates", () => {
        let pct = 0;
        const node = new DisplayProgress("Test", () => ({ progress: pct }));

        expect(node.getDisplayState()).toEqual({ progress: 0 });

        pct = 1;
        expect(node.getDisplayState()).toEqual({ progress: 1 });
    });
});
