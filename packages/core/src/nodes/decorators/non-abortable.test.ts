import { describe, expect, it, vi } from "vitest";
import { BTNode, NodeResult } from "../../base";
import { createTickContext, StubAction } from "../../test-helpers";
import { OnAbort } from "./on-abort";
import { NonAbortable } from "./non-abortable";

describe("NonAbortable decorator", () => {
    it("ticks child and returns its result", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const node = new NonAbortable(child);

        const result = BTNode.Tick(node, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("swallows abort propagation to child", () => {
        const child = new StubAction(NodeResult.Running);
        const node = new NonAbortable(child);

        BTNode.Tick(node, createTickContext());
        BTNode.Abort(node, createTickContext());

        expect(child.abortCount).toBe(0);
    });

    it("lets the child continue after parent aborts the decorator", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const node = new NonAbortable(child);

        expect(BTNode.Tick(node, createTickContext())).toBe(NodeResult.Running);
        BTNode.Abort(node, createTickContext());
        expect(BTNode.Tick(node, createTickContext())).toBe(NodeResult.Succeeded);

        expect(child.abortCount).toBe(0);
        expect(child.resumeCount).toBe(1);
    });

    it("works with outer OnAbort hooks while still shielding child", () => {
        const cb = vi.fn();
        const child = new StubAction(NodeResult.Running);
        const node = new OnAbort(new NonAbortable(child), cb);

        BTNode.Tick(node, createTickContext());
        BTNode.Abort(node, createTickContext());

        expect(cb).toHaveBeenCalledTimes(1);
        expect(child.abortCount).toBe(0);
    });
});
