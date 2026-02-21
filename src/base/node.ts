import { TickTraceEvent } from "./types";
import { NodeResult, NodeType } from "./types";

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
    public abstract readonly NODE_TYPE: NodeType;

    public name: string = "";
    constructor(name?: string) {
        if (name) {
            this.name = name;
        }
    }

    public get displayName(): string {
        if (this.name) {
            return this.name;
        }

        return `${this.NODE_TYPE}`;
    }

    public static Tick(node: BTNode, ctx: TickContext): NodeResult {
        const result = node.onTick(ctx);
        node.onTicked(result, ctx);

        if (result === NodeResult.Succeeded) {
            node.onSuccess(ctx);
        } else if (result === NodeResult.Failed) {
            node.onFailed(ctx);
        }
        if (result === NodeResult.Succeeded || result === NodeResult.Failed) {
            node.onFinished(result, ctx);
        }

        ctx.trace(node, result);
        return result;
    }

    public static Abort(node: BTNode, ctx: TickContext): void {
        node.onAbort(ctx);
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

    protected onTick(ctx: TickContext): NodeResult { throw new Error(`Node [${this.id}]${this.name} does not implement onTick`); };
    protected onAbort(ctx: TickContext): void { };

    // Some helper methods that could be done inside onTick but are here for convenience
    protected onTicked(result: NodeResult, ctx: TickContext): void { };
    protected onSuccess(ctx: TickContext): void { };
    protected onFailed(ctx: TickContext): void { };
    protected onFinished(result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext): void { };
}

export interface TickContext {
    tickId: number;
    tickNumber: number;
    now: number;
    events: TickTraceEvent[];
    trace: (node: BTNode, result: NodeResult) => void;
};