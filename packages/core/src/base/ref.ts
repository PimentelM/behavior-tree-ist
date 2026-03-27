import { type TickContext } from "./node";
import { AmbientContext } from "./ambient-context";
import { type RefChangeEvent, isDisplayable } from "./types";
import { pushRefEvent } from "./ref-event";

export interface ReadonlyRef<T> {
    readonly value: T;
    readonly name: string | undefined;
}

export interface Ref<T> extends ReadonlyRef<T> {
    value: T;
    set(newValue: T, ctx?: TickContext, mutationNodeId?: number): void;
}

export class ValueRef<T> implements Ref<T> {
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

    set(newValue: T, ctx?: TickContext, mutationNodeId?: number): void {
        if (this._value === newValue) return;
        this._value = newValue;

        const effectiveCtx = ctx ?? AmbientContext.getTickContext();
        if (!effectiveCtx || !effectiveCtx.isStateTraceEnabled || this.name === undefined) return;

        const nodeId = mutationNodeId ?? AmbientContext.getCurrentMutationNodeId();
        const event: RefChangeEvent = {
            tickId: effectiveCtx.tickId,
            timestamp: effectiveCtx.now,
            refName: this.name,
            nodeId,
            ...(isDisplayable(newValue)
                ? { displayValue: newValue.toDisplayString() }
                : { newValue: newValue as unknown }),
            isAsync: false,
        };

        pushRefEvent(effectiveCtx, event);
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
    return new ValueRef(initialValue, name);
}

export function readonlyRef<T>(source: Ref<T>): ReadonlyRef<T> {
    return source;
}

export function derivedRef<T>(compute: () => T, name?: string): DerivedRef<T> {
    return new DerivedRef(compute, name);
}

export class ProxyRef<T> implements Ref<T> {
    public readonly name: string | undefined;
    private readonly _getter: () => T;
    private readonly _setter: (v: T) => void;

    constructor(getter: () => T, setter: (v: T) => void, name?: string) {
        this._getter = getter;
        this._setter = setter;
        this.name = name;
    }

    get value(): T {
        return this._getter();
    }

    set value(newValue: T) {
        this.set(newValue);
    }

    set(newValue: T, ctx?: TickContext, mutationNodeId?: number): void {
        if (this._getter() === newValue) return;
        this._setter(newValue);

        const effectiveCtx = ctx ?? AmbientContext.getTickContext();
        if (!effectiveCtx || !effectiveCtx.isStateTraceEnabled || this.name === undefined) return;

        const nodeId = mutationNodeId ?? AmbientContext.getCurrentMutationNodeId();
        const event: RefChangeEvent = {
            tickId: effectiveCtx.tickId,
            timestamp: effectiveCtx.now,
            refName: this.name,
            nodeId,
            ...(isDisplayable(newValue)
                ? { displayValue: newValue.toDisplayString() }
                : { newValue: newValue as unknown }),
            isAsync: false,
        };

        pushRefEvent(effectiveCtx, event);
    }
}

export function proxyRef<T>(getter: () => T, setter: (v: T) => void, name?: string): ProxyRef<T> {
    return new ProxyRef(getter, setter, name);
}
