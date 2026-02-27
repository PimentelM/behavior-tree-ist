import { describe, it, expect } from "vitest";
import { Throttle } from "./throttle";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Throttle", () => {
    it("ticks child on first tick", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        const result = BTNode.Tick(throttle, createTickContext({ now: 5000 }));

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("returns Failed within throttle window without ticking child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));
        const result = BTNode.Tick(throttle, createTickContext({ now: 5500 }));

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);
    });

    it("ticks child after window expires and starts new throttle period", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));
        const result = BTNode.Tick(throttle, createTickContext({ now: 6000 }));

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(2);
    });

    it("always ticks child when lastChildResult was Running, bypassing throttle", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Running, NodeResult.Succeeded]);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));
        BTNode.Tick(throttle, createTickContext({ now: 5010 }));
        const result = BTNode.Tick(throttle, createTickContext({ now: 5020 }));

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(3);
    });

    it("does not start throttle when child returns Running", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));
        // Child was Running, no throttle started. Next tick succeeds.
        BTNode.Tick(throttle, createTickContext({ now: 5010 }));

        // Throttle window started at t=5010 when child succeeded
        // At t=5500 (<1000 from t=5010), should be throttled
        const result = BTNode.Tick(throttle, createTickContext({ now: 5500 }));

        expect(result).toBe(NodeResult.Failed);
    });

    it("preserves throttle state on abort but still aborts child", () => {
        // Throttle must be Running for abort to be effective
        const child = new StubAction(NodeResult.Running);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 })); // child Running, throttle Running
        BTNode.Abort(throttle, createTickContext()); // throttle state preserved, but child aborted
        // Throttle state preserved, still within window
        const result = BTNode.Tick(throttle, createTickContext({ now: 5100 }));

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });

    it("works correctly when triggered at tick 0", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 100);

        // Trigger at now=0 — sentinel check must use === undefined, not falsy
        const r1 = BTNode.Tick(throttle, createTickContext({ now: 0 }));
        expect(r1).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);

        // Still within throttle window
        const r2 = BTNode.Tick(throttle, createTickContext({ now: 50 }));
        expect(r2).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);

        // Exactly at throttle boundary — fires again
        const r3 = BTNode.Tick(throttle, createTickContext({ now: 100 }));
        expect(r3).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(2);
    });

    it("displays remaining time in displayName when throttled", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));
        BTNode.Tick(throttle, createTickContext({ now: 5300 }));

        expect(throttle.displayName).toBe("Throttle (700)");
    });

    it("displays correct remaining time when triggered at tick 0", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 0 }));
        BTNode.Tick(throttle, createTickContext({ now: 300 }));

        expect(throttle.displayName).toBe("Throttle (700)");
    });

    it("displayName shows decreasing remaining time during throttle window", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const throttle = new Throttle(child, 1000);

        BTNode.Tick(throttle, createTickContext({ now: 5000 }));

        // Throttled tick at 5300 updates lastNow, remaining = 700
        BTNode.Tick(throttle, createTickContext({ now: 5300 }));
        expect(throttle.displayName).toBe("Throttle (700)");

        // Throttled tick at 5800, remaining = 200
        BTNode.Tick(throttle, createTickContext({ now: 5800 }));
        expect(throttle.displayName).toBe("Throttle (200)");
    });
});
