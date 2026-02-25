import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export type UtilityScorer = (ctx: TickContext) => number;

export interface UtilityNodeSpec {
    node: BTNode;
    scorer: UtilityScorer;
}
export type UtilitySelectorState = {
    lastScores: [number, number][] | undefined;
};


export class UtilitySelector extends Composite {
    public override readonly defaultName = "UtilitySelector";
    private specs: UtilityNodeSpec[] = [];
    private currentlyRunningIndex: number | undefined = undefined;
    private lastScores: { index: number; score: number }[] | undefined = undefined;

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector, NodeFlags.Utility, NodeFlags.Stateful);
    }

    public static from(specs: UtilityNodeSpec[]): UtilitySelector
    public static from(name: string, specs: UtilityNodeSpec[]): UtilitySelector
    public static from(nameOrSpecs: string | UtilityNodeSpec[], possiblySpecs?: UtilityNodeSpec[]): UtilitySelector {
        const name = typeof nameOrSpecs === "string" ? nameOrSpecs : "";
        const specs = Array.isArray(nameOrSpecs) ? nameOrSpecs : possiblySpecs!;
        const composite = new UtilitySelector(name);
        composite.setUtilityNodes(specs);
        return composite;
    }

    public override getDisplayState(): UtilitySelectorState {
        return {
            lastScores: this.lastScores?.map(score => [score.index, score.score])
        };
    }

    public override addNode(_node: BTNode): never {
        throw new Error("Use setUtilityNodes() to add nodes to a UtilitySelector");
    }

    public override setNodes(_nodes: BTNode[]): never {
        throw new Error("Use setUtilityNodes() to set nodes on a UtilitySelector");
    }

    public override clearNodes(): never {
        throw new Error("Use setUtilityNodes() to manage nodes on a UtilitySelector");
    }

    public setUtilityNodes(specs: UtilityNodeSpec[]): void {
        super.clearNodes();
        this.specs = specs;
        for (const spec of specs) {
            super.addNode(spec.node);
        }
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`UtilitySelector node ${this.name} has no nodes`);
        }

        // Evaluate scores every tick
        const scoredIndices = this.specs.map((spec, index) => ({
            index,
            score: spec.scorer(ctx)
        }));
        this.lastScores = scoredIndices;

        // Sort descending by score
        scoredIndices.sort((a, b) => b.score - a.score);

        let finalResult: NodeResult = NodeResult.Failed;
        let runningOrSucceededIndex: number | undefined = undefined;

        for (const { index } of scoredIndices) {
            const node = this.nodes[index];
            const result = BTNode.Tick(node, ctx);

            if (result === NodeResult.Succeeded || result === NodeResult.Running) {
                finalResult = result;
                runningOrSucceededIndex = index;
                break;
            }
        }

        // Abort any node that was previously running but isn't the one we just ticked and returned running/succeeded.
        // Also abort it if we completely failed out.
        if (this.currentlyRunningIndex !== undefined && this.currentlyRunningIndex !== runningOrSucceededIndex) {
            BTNode.Abort(this.nodes[this.currentlyRunningIndex], ctx);
        }

        if (finalResult === NodeResult.Running) {
            this.currentlyRunningIndex = runningOrSucceededIndex;
        } else {
            this.currentlyRunningIndex = undefined;
        }

        return finalResult;
    }

    protected override onReset(): void {
        this.currentlyRunningIndex = undefined;
    }

    protected override onAbort(ctx: TickContext): void {
        this.lastScores = undefined;
        super.onAbort(ctx);
    }
}
