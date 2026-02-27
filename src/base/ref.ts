import { BTNode, TickContext } from "./node";
import { RefChangeEvent } from "./types";

export interface ReadonlyRef<T> {
    readonly value: T;
    readonly name: string | undefined;
}

export class Ref<T> implements ReadonlyRef<T> {
    private _value: T;
    public readonly name: string | undefined;

    constructor(initialValue: T, name?: string) {
        this._value = initialValue;
        this.name = name;
    }

    get value(): T {
        return this._value;
    }

    set value(newValue: T) {
        this.set(newValue);
    }

    set(newValue: T, ctx?: TickContext): void {
        if (this._value === newValue) return;
        this._value = newValue;

        const effectiveCtx = ctx ?? BTNode.currentTickContext;
        if (!effectiveCtx || !effectiveCtx.isTracingEnabled || this.name === undefined) return;

        const event: RefChangeEvent = {
            tickId: effectiveCtx.tickId,
            timestamp: effectiveCtx.now,
            refName: this.name,
            newValue: newValue as unknown,
            isAsync: false,
        };

        const runtime = effectiveCtx.runtime;
        if (runtime) {
            if (runtime.isTickRunning) {
                runtime.latest!.refEvents.push(event);
            } else {
                runtime.pendingRefEvents.push(event);
            }
        } else {
            effectiveCtx.refEvents.push(event);
        }
    }

    asReadonly(): ReadonlyRef<T> {
        return this;
    }
}

export class DerivedRef<T> implements ReadonlyRef<T> {
    public readonly name: string | undefined;
    private readonly _compute: () => T;

    constructor(compute: () => T, name?: string) {
        this._compute = compute;
        this.name = name;
    }

    get value(): T {
        return this._compute();
    }
}

export function ref<T>(initialValue: T, name?: string): Ref<T> {
    return new Ref(initialValue, name);
}

export function readonlyRef<T>(source: Ref<T>): ReadonlyRef<T> {
    return source;
}

export function derivedRef<T>(compute: () => T, name?: string): DerivedRef<T> {
    return new DerivedRef(compute, name);
}
