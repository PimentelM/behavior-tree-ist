import { TickTraceEvent } from "./types";
import { NodeResult, NodeFlags, SerializableState } from "./types";

type AnyDecoratorSpec = readonly [unknown, ...readonly unknown[]];

type ValidateDecoratorSpec<Spec extends AnyDecoratorSpec> =
    Spec extends readonly [infer Ctor, ...infer Args]
    ? Ctor extends abstract new (...ctorArgs: infer CtorArgs) => BTNode
    ? CtorArgs extends readonly [BTNode, ...infer TailArgs]
    ? Args extends TailArgs
    ? readonly [Ctor, ...Args]
    : never
    : never
    : never
    : never;

type ValidateDecoratorSpecs<Specs extends readonly AnyDecoratorSpec[]> = {
    [K in keyof Specs]: Specs[K] extends AnyDecoratorSpec ? ValidateDecoratorSpec<Specs[K]> : never;
};

export abstract class BTNode {
    private static NEXT_ID = 1;
    public readonly id: number = BTNode.NEXT_ID++;
    public abstract readonly defaultName: string;

    /** Whether this node returned Running on its last tick */
    private _wasRunning: boolean = false;
    public get wasRunning(): boolean { return this._wasRunning; }

    private _nodeFlags: NodeFlags = 0;
    public get nodeFlags(): NodeFlags { return this._nodeFlags; }
    protected addFlags(...flags: number[]): void {
        for (const flag of flags) {
            this._nodeFlags |= flag;
        }
    }

    public name: string = "";
    constructor(name?: string) {
        if (name) {
            this.name = name;
        }
    }

    /* 
        We do not need to provide the whole state of a node here, just the essential
        for debugging and visualization purposes. 
    */
    public getDisplayState?(): SerializableState | undefined

    public getChildren?(): ReadonlyArray<BTNode>;

    public get displayName(): string {
        if (this.name) {
            return this.name;
        }

        return this.defaultName;
    }

    public static Tick(node: BTNode, ctx: TickContext): NodeResult {
        if (!node._wasRunning) {
            node.onEnter?.(ctx);
        }

        const result = node.onTick(ctx);

        // If node was Running and now reached terminal state, call onReset
        if (node._wasRunning && result !== NodeResult.Running) {
            node.onReset?.(ctx);
        }

        // Track for next tick
        node._wasRunning = result === NodeResult.Running;

        node.onTicked?.(result, ctx);

        if (result === NodeResult.Succeeded) {
            node.onSuccess?.(ctx);
        } else if (result === NodeResult.Failed) {
            node.onFailed?.(ctx);
        }
        if (result === NodeResult.Succeeded || result === NodeResult.Failed) {
            node.onFinished?.(result, ctx);
        }
        if (result === NodeResult.Running) {
            node.onRunning?.(ctx);
        }
        if (result === NodeResult.Succeeded || result === NodeResult.Running) {
            node.onSuccessOrRunning?.(ctx);
        }
        if (result === NodeResult.Failed || result === NodeResult.Running) {
            node.onFailedOrRunning?.(ctx);
        }

        ctx.trace(node, result);
        return result;
    }

    public static Abort(node: BTNode, ctx: TickContext): void {
        if (node._wasRunning) {
            node.onReset?.(ctx);
            node.onAbort?.(ctx);
            node._wasRunning = false;
        }
    }

    public decorate<const Specs extends readonly AnyDecoratorSpec[]>(...specs: Specs & ValidateDecoratorSpecs<Specs>): BTNode {
        // Apply from right-to-left so the first decorator specified becomes the outermost wrapper.
        let current: BTNode = this;
        for (let i = specs.length - 1; i >= 0; i--) {
            const [Ctor, ...args] = specs[i] as unknown as [new (child: BTNode, ...args: readonly unknown[]) => BTNode, ...readonly unknown[]];
            current = new Ctor(current, ...args);
        }
        return current;
    }

    protected abstract onTick(ctx: TickContext): NodeResult;

    /**
     * Called on the first tick of a fresh execution (when the node was not
     * previously Running). Symmetric counterpart to onReset.
     * Use this for initializing state, recording start time, acquiring resources, etc.
     */
    protected onEnter?(_ctx: TickContext): void;

    /**
     * Called when the node transitions OUT of Running state.
     * This happens when:
     *   - Node was Running and now returns Succeeded/Failed (natural completion)
     *   - Node was Running and is aborted (interrupted)
     *
     * Use this for state cleanup that should happen regardless of how
     * the node stopped running. Implementation must be idempotent.
     */
    protected onReset?(_ctx: TickContext): void;

    /** Implementation must be idempotent. Called after onReset on abort. */
    protected onAbort?(_ctx: TickContext): void;

    // Some helper methods that could be done inside onTick but are here for convenience
    protected onTicked?(_result: NodeResult, _ctx: TickContext): void { };
    protected onSuccess?(_ctx: TickContext): void { };
    protected onFailed?(_ctx: TickContext): void { };
    protected onRunning?(_ctx: TickContext): void { };
    protected onSuccessOrRunning?(_ctx: TickContext): void { };
    protected onFailedOrRunning?(_ctx: TickContext): void { };
    protected onFinished?(_result: NodeResult & ('Succeeded' | 'Failed'), _ctx: TickContext): void { };
}

export interface TickContext {
    tickId: number;
    tickNumber: number;
    now: number;
    events: TickTraceEvent[];
    trace: (node: BTNode, result: NodeResult) => void;
};
