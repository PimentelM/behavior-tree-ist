import { AmbientContext } from "./ambient-context";
import type { RefChangeEvent } from "./types";
import { pushRefEvent } from "./ref-event";

/**
 * A multi-field observable ref. Looks like a plain typed object,
 * but emits RefChangeEvents on each field mutation.
 *
 * Event refName format: `"${name}.${field}"` (e.g. `"myBB.targetId"`).
 */
export type MultiRef<T extends Record<string, unknown>> = T &
    ("name" extends keyof T ? unknown : { readonly name: string });

function emitRefChange(refName: string, newValue: unknown): void {
    const ctx = AmbientContext.getTickContext();
    if (!ctx || !ctx.isStateTraceEnabled) return;

    const nodeId = AmbientContext.getCurrentMutationNodeId();
    const event: RefChangeEvent = {
        tickId: ctx.tickId,
        timestamp: ctx.now,
        refName,
        nodeId,
        newValue,
        isAsync: false,
    };

    pushRefEvent(ctx, event);
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
            configurable: true,
            get() {
                return storage[key];
            },
            set(value: unknown) {
                if (storage[key] === value) return;
                storage[key] = value;
                emitRefChange(`${name}.${key}`, value);
            },
        });
    }

    if (!Object.prototype.hasOwnProperty.call(defaults, "name")) {
        Object.defineProperty(obj, "name", {
            value: name,
            enumerable: false,
            writable: false,
            configurable: true,
        });
    }

    return obj;
}

/**
 * Patches an existing object (typically a class instance) to emit RefChangeEvents
 * on field mutations. Only own enumerable writable data properties are intercepted;
 * prototype methods, getters, and non-writable fields are left untouched.
 *
 * Returns the same instance (mutated in-place).
 *
 * @example
 * ```ts
 * class AgentState {
 *     health = 100;
 *     target: string | null = null;
 *     get isAlive() { return this.health > 0; }
 *     reset() { this.health = 100; this.target = null; }
 * }
 * const state = patchRef("agent", new AgentState());
 * state.health = 50;  // emits RefChangeEvent "agent.health"
 * state.isAlive;      // true (getter works)
 * state.reset();      // emits events for health + target
 * ```
 */
export function patchRef<T extends object>(name: string, instance: T): T {
    for (const key of Object.keys(instance)) {
        const desc = Object.getOwnPropertyDescriptor(instance, key);
        if (!desc || !("value" in desc) || !desc.writable) continue;

        let stored: unknown = desc.value;

        Object.defineProperty(instance, key, {
            enumerable: desc.enumerable,
            configurable: true,
            get() {
                return stored;
            },
            set(value: unknown) {
                if (stored === value) return;
                stored = value;
                emitRefChange(`${name}.${key}`, value);
            },
        });
    }

    return instance;
}
