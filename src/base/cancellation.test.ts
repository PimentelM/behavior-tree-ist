import { describe, it, expect, vi } from "vitest";
import { createCancellationHandle } from "./cancellation";

describe("CancellationHandle", () => {
    it("starts with aborted = false", () => {
        const handle = createCancellationHandle();
        expect(handle.signal.aborted).toBe(false);
    });

    it("cancel() sets aborted = true", () => {
        const handle = createCancellationHandle();
        handle.cancel();
        expect(handle.signal.aborted).toBe(true);
    });

    it("listeners fire on cancel()", () => {
        const handle = createCancellationHandle();
        const listener = vi.fn();
        handle.signal.onAbort(listener);

        expect(listener).not.toHaveBeenCalled();
        handle.cancel();
        expect(listener).toHaveBeenCalledOnce();
    });

    it("listener registered after cancel fires immediately", () => {
        const handle = createCancellationHandle();
        handle.cancel();

        const listener = vi.fn();
        handle.signal.onAbort(listener);
        expect(listener).toHaveBeenCalledOnce();
    });

    it("cancel() is idempotent", () => {
        const handle = createCancellationHandle();
        const listener = vi.fn();
        handle.signal.onAbort(listener);

        handle.cancel();
        handle.cancel();
        handle.cancel();

        expect(listener).toHaveBeenCalledOnce();
    });
});
