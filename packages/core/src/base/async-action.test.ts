import { describe, it, expect, vi } from "vitest";
import { AsyncAction } from "./async-action";
import { NodeResult } from "./types";
import { createNodeTicker } from "../test-helpers";
import { CancellationSignal } from "./cancellation";

describe("AsyncAction", () => {
    it("First tick returns Running", async () => {
        let resolvePromise!: (result?: void) => void;
        const execute = vi.fn().mockImplementation(() => {
            return new Promise<void>((resolve) => {
                resolvePromise = resolve;
            });
        });

        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        const result = ticker.tick(node);
        expect(result).toBe(NodeResult.Running);
        expect(node.getDisplayState()?.status).toBe("pending");

        resolvePromise();
        await Promise.resolve(); // Microtask tick

        expect(ticker.tick(node)).toBe(NodeResult.Succeeded);
        expect(node.getDisplayState()?.status).toBe("resolved");
    });

    it("Resolves with void/undefined -> Succeeded on next tick", async () => {
        const execute = vi.fn().mockResolvedValue(undefined);
        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve(); // Microtask tick
        await Promise.resolve(); // Wait for promise to settle in async action code
        expect(ticker.tick(node)).toBe(NodeResult.Succeeded);
    });

    it("Resolves with explicit NodeResult.Failed -> Failed on next tick", async () => {
        const execute = vi.fn().mockResolvedValue(NodeResult.Failed);
        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve();
        await Promise.resolve();
        expect(ticker.tick(node)).toBe(NodeResult.Failed);
    });

    it("Resolves with explicit NodeResult.Succeeded -> Succeeded on next tick", async () => {
        const execute = vi.fn().mockResolvedValue(NodeResult.Succeeded);
        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve();
        await Promise.resolve();
        expect(ticker.tick(node)).toBe(NodeResult.Succeeded);
    });

    it("Rejects -> Failed on next tick, lastError set", async () => {
        const execute = vi.fn().mockRejectedValue(new Error("Boom"));
        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve();
        await Promise.resolve();

        expect(ticker.tick(node)).toBe(NodeResult.Failed);
        expect(node.lastError).toEqual(new Error("Boom"));
        expect(node.getDisplayState()?.status).toBe("rejected");
        expect(node.getDisplayState()?.error).toBe("Error: Boom");
    });

    it("Synchronous throw in execute() -> Failed on first tick", () => {
        const execute = vi.fn().mockImplementation(() => {
            throw new Error("Sync boom");
        });
        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Failed);
        expect(node.lastError).toEqual(new Error("Sync boom"));
    });

    it("Abort fires cancellation signal", () => {
        let signalRef!: CancellationSignal;
        const execute = vi.fn().mockImplementation((_ctx, signal) => {
            signalRef = signal;
            return new Promise<void>(() => { }); // pending forever
        });

        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        ticker.tick(node);
        expect(signalRef.aborted).toBe(false);
        ticker.abort(node);
        expect(signalRef.aborted).toBe(true);
    });

    it("Reuse after success (node resets, runs again cleanly)", async () => {
        let resolveCount = 0;
        const execute = vi.fn().mockImplementation(() => {
            resolveCount++;
            return Promise.resolve(NodeResult.Succeeded);
        });

        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve();
        await Promise.resolve();
        expect(ticker.tick(node)).toBe(NodeResult.Succeeded);

        // Run again
        expect(ticker.tick(node)).toBe(NodeResult.Running);
        await Promise.resolve();
        await Promise.resolve();
        expect(ticker.tick(node)).toBe(NodeResult.Succeeded);

        expect(resolveCount).toBe(2);
    });

    it("Reuse after abort", () => {
        const execute = vi.fn().mockImplementation(() => {
            return new Promise<void>(() => { }); // pending forever
        });

        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        ticker.tick(node); // Running
        ticker.abort(node); // Aborts, resets
        expect(node.getDisplayState()?.status).toBe('idle');

        ticker.tick(node); // Runs again
        expect(node.getDisplayState()?.status).toBe('pending');
    });

    it("Stale promise results ignored after abort/reset", async () => {
        let resolvePromise!: (result?: void) => void;
        const execute = vi.fn().mockImplementation(() => {
            return new Promise<void>((resolve) => {
                resolvePromise = resolve;
            });
        });

        const node = AsyncAction.from("Test", execute);
        const ticker = createNodeTicker();

        ticker.tick(node);
        const firstResolve = resolvePromise;

        ticker.abort(node); // Node is reset

        // Resolve the first promise now that it's obsolete
        firstResolve();
        await Promise.resolve();

        // State should remain idle, not resolved from the stale promise
        expect(node.getDisplayState()?.status).toBe('idle');

        // Tick again, it should be pending
        expect(ticker.tick(node)).toBe(NodeResult.Running);
        expect(node.getDisplayState()?.status).toBe('pending');
    });
});
