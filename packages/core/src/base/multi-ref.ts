import { AmbientContext } from "./ambient-context";
import type { RefChangeEvent } from "./types";
import { pushRefEvent } from "./ref-event";

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
