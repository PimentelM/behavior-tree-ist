import { describe, it, expect } from "vitest";
import { HardThrottle } from "./hard-throttle";
import { NodeResult } from "../../base";
import { StubAction, tickNode } from "../../test-helpers";
import { BTNode } from "../../base/node";

describe("HardThrottle", () => {
    it("returns node result on first tick", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new HardThrottle(child, 100);

        const result = tickNode(throttle, { now: 0 });

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns failed while throttling", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new HardThrottle(child, 100);

        tickNode(throttle, { now: 0 }); // ticks child
        const result = tickNode(throttle, { now: 50 }); // throttles

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);
    });

    it("returns failed and aborts trailing running state while throttling", () => {
        const child = new StubAction(NodeResult.Running);
        const throttle = new HardThrottle(child, 100);

        tickNode(throttle, { now: 0 }); // ticks child, returns Running
        const result = tickNode(throttle, { now: 50 }); // throttles even if running

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1); // Not ticked again
        expect(child.abortCount).toBe(1); // Properly aborted state loss
    });

    it("ticks again after throttle expires", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new HardThrottle(child, 100);

        tickNode(throttle, { now: 0 }); // success
        tickNode(throttle, { now: 50 }); // throttled (failed)
        const result = tickNode(throttle, { now: 100 }); // success again

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(2);
    });
});
