import { AmbientContext } from "./ambient-context";

let tickIdentityGetter: (() => string | number) | null = null;

export function _setTickIdentityGetter(getter: (() => string | number) | null): void {
    tickIdentityGetter = getter;
}

export function _getTickIdentityGetter(): (() => string | number) | null {
    return tickIdentityGetter;
}

function getCurrentFrameId(): string | number | null {
    if (tickIdentityGetter !== null) {
        return tickIdentityGetter();
    }
    const ctx = AmbientContext.getTickContext();
    if (ctx?.runtime !== undefined) {
        return `${ctx.runtime.treeId}:${ctx.tickId}`;
    }
    return null;
}

function argsMatch<Args extends unknown[]>(a: Args, b: Args): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function tickMemo<T, Args extends unknown[]>(
    fn: (...args: Args) => T
): (...args: Args) => T {
    let cachedFrameId: string | number | null = null;
    let entries: { args: Args; result: T }[] = [];

    return (...args: Args): T => {
        const frameId = getCurrentFrameId();
        if (frameId === null) return fn(...args);

        if (cachedFrameId !== frameId) {
            cachedFrameId = frameId;
            entries = [];
        }

        for (const entry of entries) {
            if (argsMatch(entry.args, args)) return entry.result;
        }

        const result = fn(...args);
        entries.push({ args, result });
        return result;
    };
}
