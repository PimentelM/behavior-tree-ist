import { BTNode, TickContext } from "./node";
import { CancellationSignal, CancellationHandle, createCancellationHandle } from "./cancellation";
import { NodeFlags, NodeResult, SerializableState } from "./types";

export abstract class AsyncAction extends BTNode {
    public readonly defaultName = "AsyncAction";
    private _handle: CancellationHandle | null = null;
    private _settled: boolean = false;
    private _result: NodeResult | undefined;
    private _error: unknown;
    private _currentRun: object | null = null;

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Leaf | NodeFlags.Action | NodeFlags.Stateful | NodeFlags.Async);
    }

    public static from(name: string, execute: (ctx: TickContext, signal: CancellationSignal) => Promise<NodeResult | void>): AsyncAction {
        class InlineAsyncAction extends AsyncAction {
            protected execute(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult | void> {
                return execute(ctx, signal);
            }
        }
        return new InlineAsyncAction(name);
    }

    public get lastError(): unknown {
        return this._error;
    }

    public override getDisplayState(): SerializableState {
        let status = 'idle';
        if (this._currentRun) {
            status = this._settled ? 'resolved' : 'pending';
            if (this._error !== undefined) {
                status = 'rejected';
            }
        }

        return {
            status,
            ...(this._error !== undefined ? { error: String(this._error) } : {})
        };
    }

    protected abstract execute(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult | void>;

    protected override onEnter(ctx: TickContext): void {
        this._handle = createCancellationHandle();
        this._settled = false;
        this._result = undefined;
        this._error = undefined;

        const generation = {};
        this._currentRun = generation;

        try {
            const promise = this.execute(ctx, this._handle.signal);
            if (!promise || typeof (promise as { then?: unknown }).then !== 'function') {
                this._settled = true;
                this._result = typeof promise === 'number' ? promise as NodeResult : NodeResult.Succeeded;
                return;
            }

            promise.then(
                (result) => {
                    if (this._currentRun !== generation) return;
                    this._settled = true;
                    this._result = result ?? NodeResult.Succeeded;
                },
                (error) => {
                    if (this._currentRun !== generation) return;
                    this._settled = true;
                    this._error = error;
                    this._result = NodeResult.Failed;
                }
            );
        } catch (error) {
            this._settled = true;
            this._error = error;
            this._result = NodeResult.Failed;
        }
    }

    protected override onTick(_ctx: TickContext): NodeResult {
        if (this._settled) {
            return this._result!;
        }
        return NodeResult.Running;
    }

    protected override onReset(_ctx: TickContext): void {
        this._handle = null;
    }

    protected override onAbort(_ctx: TickContext): void {
        if (this._handle) {
            this._handle.cancel();
        }
        this._currentRun = null;
    }
}
