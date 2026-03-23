import { AmbientContext } from "./ambient-context";
import type { RefChangeEvent } from "./types";
import { pushRefEvent } from "./ref-event";
import { type Ref, ProxyRef } from "./ref";

export type MultiRef<T extends Record<string, unknown>> = T &
    ("name" extends keyof T ? unknown : { readonly name: string }) & {
        getRef<K extends keyof T & string>(key: K): Ref<T[K]>;
    };

function emitRefChange(refName: string, newValue: unknown): void {
    const ctx = AmbientContext.getTickContext();
    if (!ctx?.isStateTraceEnabled) return;

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
    const obj = ({} as unknown) as MultiRef<T>;

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

    Object.defineProperty(obj, "getRef", {
        enumerable: false,
        configurable: true,
        writable: false,
        value<K extends keyof T & string>(key: K): ProxyRef<T[K]> {
            return new ProxyRef(
                () => storage[key] as T[K],
                (v: T[K]) => { (obj as Record<string, unknown>)[key] = v; },
            );
        },
    });

    return obj;
}

type WithGetRef<T extends object> = T & {
    getRef<K extends keyof T & string>(key: K): Ref<T[K]>;
};

export function patchRef<T extends object>(name: string, instance: T): WithGetRef<T> {
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

    Object.defineProperty(instance, "getRef", {
        enumerable: false,
        configurable: true,
        writable: false,
        value<K extends keyof T & string>(key: K): ProxyRef<T[K]> {
            return new ProxyRef(
                () => (instance as Record<string, unknown>)[key] as T[K],
                (v: T[K]) => { (instance as Record<string, unknown>)[key] = v; },
            );
        },
    });

    return instance as WithGetRef<T>;
}
