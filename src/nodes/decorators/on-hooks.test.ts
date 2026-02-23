import { describe, it, expect, vi } from "vitest";
import { NodeResult } from "../../base/types";
import { StubAction, tickNode } from "../../test-helpers";
import { OnTicked } from "./on-ticked";
import { OnSuccess } from "./on-success";
import { OnFailure } from "./on-failure";
import { OnRunning } from "./on-running";
import { OnSuccessOrRunning } from "./on-success-or-running";
import { OnFailedOrRunning } from "./on-failed-or-running";
import { OnFinished } from "./on-finished";

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
});
