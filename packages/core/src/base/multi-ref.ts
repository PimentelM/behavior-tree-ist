import { AmbientContext } from "./ambient-context";
import type { TickContext } from "./node";
import type { RefChangeEvent } from "./types";

/**
 * A multi-field observable ref. Looks like a plain typed object,
 * but emits RefChangeEvents on each field mutation.
 *
 * Event refName format: `"${name}.${field}"` (e.g. `"myBB.targetId"`).
 */
export type MultiRef<T extends Record<string, unknown>> = T & {
    /** The ref group name. Non-enumerable to keep the object "plain". */
    readonly name: string;
};

function emitRefChange(
    refName: string,
    newValue: unknown,
    ctx: TickContext | undefined,
    nodeId: number | undefined,
): void {
    if (!ctx || !ctx.isStateTraceEnabled) return;

    const event: RefChangeEvent = {
        tickId: ctx.tickId,
        timestamp: ctx.now,
        refName,
        nodeId,
        newValue,
        isAsync: false,
    };

    const runtime = ctx.runtime;
    if (runtime) {
        if (runtime.isTickRunning) {
            runtime.latest!.refEvents.push(event);
        } else {
            runtime.pendingRefEvents.push(event);
        }
    } else {
        ctx.refEvents.push(event);
    }
}

/**
 * Creates a multi-field observable ref that looks like a plain typed object.
 *
 * Each field mutation emits a `RefChangeEvent` with `refName = "${name}.${field}"`.
 * Uses `===` equality check to skip no-op writes (matching `Ref<T>` semantics).
 *
 * @example
 * ```ts
 * const bb = multiRef("myBB", { targetId: 0, health: 100 });
 * bb.targetId = 5;  // emits event with refName "myBB.targetId"
 * bb.health;        // 100
 * ```
 */
export function multiRef<T extends Record<string, unknown>>(
    name: string,
    defaults: T,
): MultiRef<T> {
    const storage: Record<string, unknown> = {};
    const obj = {} as MultiRef<T>;

    for (const key of Object.keys(defaults)) {
        storage[key] = defaults[key];

        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: false,
            get() {
                return storage[key];
            },
            set(value: unknown) {
                if (storage[key] === value) return;
                storage[key] = value;

                const qualifiedName = `${name}.${key}`;
                const ctx = AmbientContext.getTickContext();
                const nodeId = AmbientContext.getCurrentMutationNodeId();
                emitRefChange(qualifiedName, value, ctx, nodeId);
            },
        });
    }

    if (!Object.prototype.hasOwnProperty.call(defaults, "name")) {
        Object.defineProperty(obj, "name", {
            value: name,
            enumerable: false,
            writable: false,
            configurable: false,
        });
    }

    return obj;
}
