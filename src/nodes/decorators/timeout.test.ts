import { describe, it, expect } from "vitest";
import { Timeout } from "./timeout";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Timeout", () => {
    it("returns child result when child completes before timeout", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const timeout = new Timeout(child, 1000);

        const result = BTNode.Tick(timeout, createTickContext({ now: 100 }));

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Running when child is Running and timeout not elapsed", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 1000);

        BTNode.Tick(timeout, createTickContext({ now: 100 }));
        const result = BTNode.Tick(timeout, createTickContext({ now: 600 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("returns Failed and aborts child when timeout elapses while Running", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 1000);

        BTNode.Tick(timeout, createTickContext({ now: 100 }));
        const result = BTNode.Tick(timeout, createTickContext({ now: 1100 }));

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });

    it("records start time on first Running tick, not from t=0", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 100);

        // First tick at t=500
        BTNode.Tick(timeout, createTickContext({ now: 500 }));

        // At t=550 (50ms after start) should still be Running
        const result = BTNode.Tick(timeout, createTickContext({ now: 550 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("resets start time when child was not previously Running", () => {
        const child = new StubAction([NodeResult.Succeeded, NodeResult.Running, NodeResult.Running]);
        const timeout = new Timeout(child, 100);

        // Child succeeds first tick
        BTNode.Tick(timeout, createTickContext({ now: 100 }));

        // Child now Running, start time should be recorded as 200
        BTNode.Tick(timeout, createTickContext({ now: 200 }));

        // 50ms after start -> still Running
        const result = BTNode.Tick(timeout, createTickContext({ now: 250 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("resets all state on abort", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 100);

        BTNode.Tick(timeout, createTickContext({ now: 100 }));
        BTNode.Tick(timeout, createTickContext({ now: 150 }));
        BTNode.Abort(timeout, createTickContext());

        // After abort, a new tick should start fresh timer
        child.nextResult = NodeResult.Running;
        BTNode.Tick(timeout, createTickContext({ now: 300 }));
        const result = BTNode.Tick(timeout, createTickContext({ now: 350 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts at exactly timeoutMs elapsed", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 100);

        BTNode.Tick(timeout, createTickContext({ now: 100 }));
        const result = BTNode.Tick(timeout, createTickContext({ now: 200 }));

        expect(result).toBe(NodeResult.Failed);
        expect(child.abortCount).toBe(1);
    });

    it("displays remaining time in displayName", () => {
        const child = new StubAction(NodeResult.Running);
        const timeout = new Timeout(child, 1000);

        BTNode.Tick(timeout, createTickContext({ now: 100 }));
        BTNode.Tick(timeout, createTickContext({ now: 400 }));

        expect(timeout.displayName).toBe("Timeout (700ms)");
    });
});
