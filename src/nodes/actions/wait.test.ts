import { describe, it, expect } from "vitest";
import { WaitAction } from "./wait";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("WaitAction", () => {
    it("returns Running before duration elapsed", () => {
        const wait = new WaitAction(1000);
        const ctx = createTickContext({ now: 0 });

        const result = BTNode.Tick(wait, ctx);

        expect(result).toBe(NodeResult.Running);
    });

    it("returns Succeeded when duration met", () => {
        const wait = new WaitAction(1000);

        BTNode.Tick(wait, createTickContext({ now: 100 }));
        const result = BTNode.Tick(wait, createTickContext({ now: 1100 }));

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Succeeded at exact boundary", () => {
        const wait = new WaitAction(500);

        BTNode.Tick(wait, createTickContext({ now: 100 }));
        const result = BTNode.Tick(wait, createTickContext({ now: 600 }));

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("works correctly when started at tick 0", () => {
        const wait = new WaitAction(100);

        // Start at now=0 — sentinel check must use === undefined, not falsy
        const r1 = BTNode.Tick(wait, createTickContext({ now: 0 }));
        expect(r1).toBe(NodeResult.Running);

        // Still waiting
        const r2 = BTNode.Tick(wait, createTickContext({ now: 50 }));
        expect(r2).toBe(NodeResult.Running);

        // Exactly at duration boundary
        const r3 = BTNode.Tick(wait, createTickContext({ now: 100 }));
        expect(r3).toBe(NodeResult.Succeeded);
    });

    it("resets start time after succeeding so it is reusable", () => {
        const wait = new WaitAction(100);

        BTNode.Tick(wait, createTickContext({ now: 0 }));
        BTNode.Tick(wait, createTickContext({ now: 100 }));

        // After succeeding, starts fresh
        const result = BTNode.Tick(wait, createTickContext({ now: 150 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("resets state on abort for a fresh wait", () => {
        const wait = new WaitAction(100);

        BTNode.Tick(wait, createTickContext({ now: 100 }));
        BTNode.Tick(wait, createTickContext({ now: 150 }));
        BTNode.Abort(wait, createTickContext());

        // After abort, timer restarted so need full 100ms from new start
        BTNode.Tick(wait, createTickContext({ now: 300 }));
        const result = BTNode.Tick(wait, createTickContext({ now: 350 }));

        expect(result).toBe(NodeResult.Running);
    });

    it("displays remaining time in displayName", () => {
        const wait = new WaitAction(1000);

        expect(wait.displayName).toBe("Wait (1000)");

        BTNode.Tick(wait, createTickContext({ now: 100 }));
        BTNode.Tick(wait, createTickContext({ now: 400 }));

        expect(wait.displayName).toBe("Wait (700)");
    });
});
