import { BTNode, TickContext } from "./node";

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
        const oldValue = this._value;
        this._value = newValue;
        const traceCtx = ctx ?? BTNode.currentTickContext;
        if (traceCtx && traceCtx.isTracingEnabled && this.name !== undefined) {
            traceCtx.refEvents.push({
                tickId: traceCtx.tickId,
                timestamp: traceCtx.now,
                refName: this.name,
                oldValue: oldValue as unknown,
                newValue: newValue as unknown,
            });
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
