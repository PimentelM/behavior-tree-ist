import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

/**
 * A Sequence that remembers which child was running and resumes from there.
 *
 * **Reactivity Trade-off**: This variant skips re-evaluation of children before
 * the running child index. This improves performance but breaks reactivity - if
 * a condition that guards earlier actions changes, it won't be detected until
 * the sequence completes or fails.
 *
 * Use standard Sequence when reactivity to changing conditions is required.
 * Use SequenceWithMemory when children are expensive to evaluate and conditions
 * are stable, or when you explicitly want "resume from where we left off" behavior.
 */

export type SequenceWithMemoryState = {
    runningChildIndex: number | undefined;
};
export class SequenceWithMemory extends Composite {
    public override readonly defaultName = "SequenceWithMemory";
    private _runningChildIndex: number | undefined;

    public get runningChildIndex(): number | undefined {
        return this._runningChildIndex;
    }

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Sequence, NodeFlags.Memory, NodeFlags.Stateful);
    }

    public static from(nodes: BTNode[]): SequenceWithMemory
    public static from(name: string, nodes: BTNode[]): SequenceWithMemory
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): SequenceWithMemory {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new SequenceWithMemory(name);
        composite.setNodes(nodes);
        return composite;
    }

    public override getDisplayState(): SequenceWithMemoryState {
        return { runningChildIndex: this._runningChildIndex };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`SequenceWithMemory node ${this.name} has no nodes`);
        }

        const startIndex = this._runningChildIndex ?? 0;

        for (let i = startIndex; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);

            if (status === NodeResult.Running) {
                this._runningChildIndex = i;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Running;
            }

            if (status === NodeResult.Failed) {
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Failed;
            }
        }

        return NodeResult.Succeeded;
    }

    protected override onReset(): void {
        this._runningChildIndex = undefined;
    }
}
