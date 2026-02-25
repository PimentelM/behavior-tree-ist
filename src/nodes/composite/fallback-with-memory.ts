import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

/**
 * A Fallback that remembers which child was running and resumes from there.
 *
 * **Reactivity Trade-off**: This variant skips re-evaluation of higher-priority
 * children before the running child index. This improves performance but breaks
 * reactivity - if a higher-priority condition becomes true, it won't preempt
 * the currently running lower-priority child.
 *
 * Use standard Fallback when reactivity to higher-priority alternatives is required.
 * Use FallbackWithMemory when children are expensive to evaluate and you want
 * "finish what you started" behavior rather than immediate preemption.
 */

export type FallbackWithMemoryState = {
    runningChildIndex: number | undefined;
};
export class FallbackWithMemory extends Composite {
    public override readonly defaultName = "FallbackWithMemory";
    private _runningChildIndex: number | undefined;

    public get runningChildIndex(): number | undefined {
        return this._runningChildIndex;
    }

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector, NodeFlags.Memory, NodeFlags.Stateful);
    }

    public static from(nodes: BTNode[]): FallbackWithMemory
    public static from(name: string, nodes: BTNode[]): FallbackWithMemory
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): FallbackWithMemory {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new FallbackWithMemory(name);
        composite.setNodes(nodes);
        return composite;
    }

    public override getDisplayState(): FallbackWithMemoryState {
        return { runningChildIndex: this._runningChildIndex };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`FallbackWithMemory node ${this.name} has no nodes`);
        }

        const startIndex = this._runningChildIndex ?? 0;

        for (let i = startIndex; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);

            if (status === NodeResult.Running) {
                this._runningChildIndex = i;
                this.abortRunningChildrenFrom(i + 1, ctx);
                return NodeResult.Running;
            }

            if (status === NodeResult.Succeeded) {
                this.abortRunningChildrenFrom(i + 1, ctx);
                return NodeResult.Succeeded;
            }
        }

        return NodeResult.Failed;
    }

    protected override onReset(): void {
        this._runningChildIndex = undefined;
    }
}
