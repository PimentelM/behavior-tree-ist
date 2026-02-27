import { TickTraceEvent, RefChangeEvent } from "./types";
import { NodeResult, NodeFlags, SerializableState } from "./types";

export type AnyDecoratorSpec = readonly [unknown, ...readonly unknown[]];

export type ValidateDecoratorSpec<Spec extends AnyDecoratorSpec> =
    Spec extends readonly [infer Ctor, ...infer Args]
    ? Ctor extends abstract new (...ctorArgs: infer CtorArgs) => BTNode
    ? CtorArgs extends readonly [BTNode, ...infer TailArgs]
    ? Args extends TailArgs
    ? readonly [Ctor, ...Args]
    : never
    : never
    : never
    : never;

export type ValidateDecoratorSpecs<Specs extends readonly AnyDecoratorSpec[]> = {
    [K in keyof Specs]: Specs[K] extends AnyDecoratorSpec ? ValidateDecoratorSpec<Specs[K]> : never;
};

export abstract class BTNode {
    // =========================================================================
    // Properties & Initialization
    // =========================================================================

    private static NEXT_ID = 1;
    public readonly id: number = BTNode.NEXT_ID++;

    public name: string = "";
    public abstract readonly defaultName: string;

    private _tags: string[] = [];
    private _nodeFlags: NodeFlags = 0;

    constructor(name?: string) {
        if (name) {
            this.name = name;
        }
    }

    public get displayName(): string {
        return this.name || this.defaultName;
    }

    public get tags(): readonly string[] {
        return this._tags;
    }

    public addTags(tags: string[]): this {
        this._tags = Array.from(new Set([...this._tags, ...tags]));
        return this;
    }

    public get nodeFlags(): NodeFlags {
        return this._nodeFlags;
    }

    protected addFlags(...flags: number[]): void {
        for (const flag of flags) {
            this._nodeFlags |= flag;
        }
    }

    // =========================================================================
    // Tree Hierarchy
    // =========================================================================

    private parent?: BTNode;

    public attachToParent(parent: BTNode): void {
        if (this.parent) {
            throw new Error(`Node ${this.displayName} (id: ${this.id}) already has a parent (${this.parent.displayName}). Nodes cannot be shared between multiple parents.`);
        }
        this.parent = parent;
    }

    public detachFromParent(): void {
        this.parent = undefined;
    }

    /** Returns the children of this node, if it's a structural node */
    public getChildren?(): ReadonlyArray<BTNode>;

    // =========================================================================
    // State & Serialization
    // =========================================================================

    /** Whether this node returned Running on its last tick */
    private _wasRunning: boolean = false;
    public get wasRunning(): boolean {
        return this._wasRunning;
    }

    /* 
        We do not need to provide the whole state of a node here, just the essential
        for debugging and visualization purposes. 
    */
    public getDisplayState?(): SerializableState | undefined;

    public toJSON() {
        return {
            id: this.id,
            name: this.name || undefined,
            defaultName: this.defaultName,
            nodeFlags: this.nodeFlags,
            tags: this.tags.length > 0 ? this.tags : undefined,
            children: this.getChildren?.(),
            state: this.getDisplayState?.(),
        };
    }

    // =========================================================================
    // Core Execution API
    // =========================================================================

    // Ambient Tick Context
    private static _ctxStack: TickContext[] = [];

    public static get currentTickContext(): TickContext | undefined {
        const stack = BTNode._ctxStack;
        return stack.length > 0 ? stack[stack.length - 1] : undefined;
    }

    public static Tick(node: BTNode, ctx: TickContext): NodeResult {
        BTNode._ctxStack.push(ctx);
        try {
            const startedAt = ctx.getTime?.();

            if (!node._wasRunning) {
                node.onEnter?.(ctx);
            } else {
                node.onResume?.(ctx);
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

            const finishedAt = ctx.getTime?.();
            ctx.trace(node, result, startedAt, finishedAt);
            return result;
        } finally {
            BTNode._ctxStack.pop();
        }
    }

    public static Abort(node: BTNode, ctx: TickContext): void {
        if (node._wasRunning) {
            BTNode._ctxStack.push(ctx);
            try {
                node.onAbort?.(ctx);
                node.onReset?.(ctx);
                node._wasRunning = false;
            } finally {
                BTNode._ctxStack.pop();
            }
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

    // =========================================================================
    // Protected Lifecycle Hooks
    // =========================================================================

    protected abstract onTick(ctx: TickContext): NodeResult;

    /**
     * ------------------------------------------------------------------------
     * Abort-only hook
     * ------------------------------------------------------------------------
     * This hook is NOT part of BTNode.Tick. It is only invoked by BTNode.Abort
     * when an external interrupt explicitly aborts a running node.
     *
     * Implementation must be idempotent. Called before onReset on abort.
     */
    protected onAbort?(_ctx: TickContext): void;

    /**
     * ------------------------------------------------------------------------
     * Tick-managed lifecycle hooks
     * ------------------------------------------------------------------------
     * These hooks are part of the normal BTNode.Tick lifecycle and are invoked
     * automatically while ticking the tree.
     */

    /**
     * Called on the first tick of a fresh execution (when the node was not
     * previously Running). Symmetric counterpart to onReset.
     * Use this for initializing state, recording start time, acquiring resources, etc.
     */
    protected onEnter?(_ctx: TickContext): void;

    /**
     * Called on continuation ticks when the node was already Running.
     * Complement to onEnter — together they partition every tick into
     * "first" vs "subsequent".
     */
    protected onResume?(_ctx: TickContext): void;

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

    protected onTicked?(_result: NodeResult, _ctx: TickContext): void { }
    protected onSuccess?(_ctx: TickContext): void { }
    protected onFailed?(_ctx: TickContext): void { }
    protected onRunning?(_ctx: TickContext): void { }
    protected onSuccessOrRunning?(_ctx: TickContext): void { }
    protected onFailedOrRunning?(_ctx: TickContext): void { }
    protected onFinished?(_result: NodeResult & ('Succeeded' | 'Failed'), _ctx: TickContext): void { }
}

export interface TickContext {
    tickId: number;
    now: number;
    events: TickTraceEvent[];
    refEvents: RefChangeEvent[];
    isTracingEnabled: boolean;
    trace: (node: BTNode, result: NodeResult, startedAt?: number, finishedAt?: number) => void;
    getTime?: () => number;
};
