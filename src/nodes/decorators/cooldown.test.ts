import { describe, it, expect } from "vitest";
import { Cooldown } from "./cooldown";
import { NodeResult } from "../../base";
import { StubAction, tickNode } from "../../test-helpers";

describe("Cooldown", () => {
    it("returns node result on first tick", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const cooldown = new Cooldown(child, 100);

        const result = tickNode(cooldown, { now: 0 });

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("does not cooldown if child is running", () => {
        const child = new StubAction(NodeResult.Running);
        const cooldown = new Cooldown(child, 100);

        tickNode(cooldown, { now: 0 }); // ticks child, returns Running
        const result = tickNode(cooldown, { now: 50 }); // ticks child again

        expect(result).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(2);
    });

    it("returns failed while cooling down after child finishes", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const cooldown = new Cooldown(child, 100);

        tickNode(cooldown, { now: 0 }); // success, starts cooldown
        const result = tickNode(cooldown, { now: 50 }); // cooling down

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);
    });

    it("ticks again after cooldown expires", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const cooldown = new Cooldown(child, 100);

        tickNode(cooldown, { now: 0 }); // success
        tickNode(cooldown, { now: 50 }); // cooling down (failed)
        const result = tickNode(cooldown, { now: 100 }); // success again

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(2);
    });
});
