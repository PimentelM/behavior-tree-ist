import { describe, it, expect, vi } from "vitest";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { StubAction, tickNode, createTickContext } from "../../test-helpers";
import { OnTicked } from "./on-ticked";
import { OnSuccess } from "./on-success";
import { OnFailure } from "./on-failure";
import { OnRunning } from "./on-running";
import { OnSuccessOrRunning } from "./on-success-or-running";
import { OnFailedOrRunning } from "./on-failed-or-running";
import { OnFinished } from "./on-finished";
import { OnReset } from "./on-reset";
import { OnAbort } from "./on-abort";
import { OnEnter } from "./on-enter";

describe("Lifecycle hook decorators", () => {
    describe("OnTicked", () => {
        it("fires on every result", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Succeeded, NodeResult.Failed, NodeResult.Running]);
            const node = new OnTicked(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(3);
            expect(cb.mock.calls[0][0]).toBe(NodeResult.Succeeded);
            expect(cb.mock.calls[1][0]).toBe(NodeResult.Failed);
            expect(cb.mock.calls[2][0]).toBe(NodeResult.Running);
        });
    });

    describe("OnSuccess", () => {
        it("fires only on Succeeded", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Succeeded, NodeResult.Failed, NodeResult.Running]);
            const node = new OnSuccess(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe("OnFailure", () => {
        it("fires only on Failed", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Failed, NodeResult.Succeeded, NodeResult.Running]);
            const node = new OnFailure(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe("OnRunning", () => {
        it("fires only on Running", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Running, NodeResult.Succeeded, NodeResult.Failed]);
            const node = new OnRunning(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(1);
        });
    });

    describe("OnSuccessOrRunning", () => {
        it("fires on Succeeded and Running but not Failed", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Succeeded, NodeResult.Running, NodeResult.Failed]);
            const node = new OnSuccessOrRunning(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(2);
        });
    });

    describe("OnFailedOrRunning", () => {
        it("fires on Failed and Running but not Succeeded", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Failed, NodeResult.Running, NodeResult.Succeeded]);
            const node = new OnFailedOrRunning(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(2);
        });
    });

    describe("OnFinished", () => {
        it("fires on Succeeded and Failed but not Running", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Succeeded, NodeResult.Failed, NodeResult.Running]);
            const node = new OnFinished(child, cb);

            tickNode(node);
            tickNode(node);
            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(2);
            expect(cb.mock.calls[0][0]).toBe(NodeResult.Succeeded);
            expect(cb.mock.calls[1][0]).toBe(NodeResult.Failed);
        });
    });

    describe("OnReset", () => {
        it("fires when child transitions out of Running", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
            const node = new OnReset(child, cb);

            tickNode(node); // Running — no reset yet
            expect(cb).not.toHaveBeenCalled();

            tickNode(node); // Succeeded — was Running → reset fires
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it("does not fire when child never returned Running", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Succeeded, NodeResult.Failed]);
            const node = new OnReset(child, cb);

            tickNode(node);
            tickNode(node);

            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe("OnAbort", () => {
        it("fires on abort and propagates to child", () => {
            const cb = vi.fn();
            const child = new StubAction(NodeResult.Running);
            const node = new OnAbort(child, cb);

            tickNode(node); // Running
            BTNode.Abort(node, createTickContext());

            expect(cb).toHaveBeenCalledTimes(1);
            expect(child.abortCount).toBe(1);
        });

        it("does not fire when not running", () => {
            const cb = vi.fn();
            const child = new StubAction(NodeResult.Succeeded);
            const node = new OnAbort(child, cb);

            tickNode(node); // Succeeded — not running
            BTNode.Abort(node, createTickContext());

            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe("OnEnter", () => {
        it("fires on first tick", () => {
            const cb = vi.fn();
            const child = new StubAction(NodeResult.Succeeded);
            const node = new OnEnter(child, cb);

            tickNode(node);

            expect(cb).toHaveBeenCalledTimes(1);
        });

        it("fires again after Running → terminal → next tick", () => {
            const cb = vi.fn();
            const child = new StubAction([NodeResult.Running, NodeResult.Succeeded, NodeResult.Failed]);
            const node = new OnEnter(child, cb);

            tickNode(node); // enter fires (first tick), child Running
            expect(cb).toHaveBeenCalledTimes(1);

            tickNode(node); // Running → Succeeded, reset
            // enter does NOT fire on this tick (was Running)
            expect(cb).toHaveBeenCalledTimes(1);

            tickNode(node); // fresh execution, enter fires again
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it("does not fire on continuation ticks", () => {
            const cb = vi.fn();
            const child = new StubAction(NodeResult.Running);
            const node = new OnEnter(child, cb);

            tickNode(node); // enter fires
            tickNode(node); // continuation
            tickNode(node); // continuation

            expect(cb).toHaveBeenCalledTimes(1);
        });
    });
});
