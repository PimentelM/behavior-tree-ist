import { describe, it, expect } from "vitest";
import { Delay } from "./delay";
import { BTNode, NodeResult } from "../../base";
import { StubAction, createTickContext } from "../../test-helpers";

describe("Delay", () => {
    it("returns Running until delay completes, then ticks child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const delay = new Delay(child, 100);

        const ctx0 = createTickContext({ now: 0 });
        const result0 = BTNode.Tick(delay, ctx0);
        expect(result0).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(0);

        const ctx50 = createTickContext({ now: 50 });
        const result50 = BTNode.Tick(delay, ctx50);
        expect(result50).toBe(NodeResult.Running);
        expect(child.tickCount).toBe(0);

        const ctx100 = createTickContext({ now: 100 });
        const result100 = BTNode.Tick(delay, ctx100);
        expect(result100).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("resets delay when aborted", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const delay = new Delay(child, 100);

        const ctx0 = createTickContext({ now: 0 });
        BTNode.Tick(delay, ctx0);

        const ctx50 = createTickContext({ now: 50 });
        BTNode.Tick(delay, ctx50);

        BTNode.Abort(delay, ctx50);

        const ctx100 = createTickContext({ now: 100 });
        const result100 = BTNode.Tick(delay, ctx100);
        expect(result100).toBe(NodeResult.Running); // Delay started over
    });
});
