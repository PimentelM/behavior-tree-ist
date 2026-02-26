import { describe, it, expect } from "vitest";
import { createNodeTicker } from "./test-helpers";
import { Action } from "./base/action";
import { NodeResult } from "./base/types";

describe("createNodeTicker", () => {
    it("assigns a unique tickId for each tick", () => {
        const seenTickIds: number[] = [];
        const action = Action.from("capture", (ctx) => {
            seenTickIds.push(ctx.tickId);
            return NodeResult.Succeeded;
        });
        const ticker = createNodeTicker();

        ticker.tick(action);
        ticker.tick(action);
        ticker.tick(action);

        expect(seenTickIds).toEqual([1, 2, 3]);
    });

    it("increments tickId across tick and abort", () => {
        const seenTickIds: number[] = [];
        const action = Action.from("capture", (ctx) => {
            seenTickIds.push(ctx.tickId);
            return NodeResult.Running;
        });
        const ticker = createNodeTicker(10);

        ticker.tick(action);
        ticker.abort(action);
        ticker.tick(action);

        expect(seenTickIds).toEqual([10, 12]);
    });
});
