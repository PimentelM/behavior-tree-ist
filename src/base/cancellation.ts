export interface CancellationSignal {
    readonly aborted: boolean;
    onAbort(listener: () => void): void;
}

export interface CancellationHandle {
    readonly signal: CancellationSignal;
    cancel(): void;
}

export function createCancellationHandle(): CancellationHandle {
    let aborted = false;
    const listeners: (() => void)[] = [];

    const signal: CancellationSignal = {
        get aborted() {
            return aborted;
        },
        onAbort(listener: () => void) {
            if (aborted) {
                listener();
            } else {
                listeners.push(listener);
            }
        }
    };

    return {
        signal,
        cancel() {
            if (aborted) return;
            aborted = true;
            for (const listener of listeners) {
                listener();
            }
            listeners.length = 0;
        }
    };
}
