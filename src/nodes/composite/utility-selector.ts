import { Composite } from "../../base/composite";
import { NodeResult, NodeType } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export type UtilityScorer = (ctx: TickContext) => number;

export interface UtilityNodeSpec {
    node: BTNode;
    scorer: UtilityScorer;
}

export class UtilitySelector extends Composite {
    public readonly NODE_TYPE: NodeType = "Selector";
    private specs: UtilityNodeSpec[] = [];
    private currentlyRunningIndex: number | undefined = undefined;

    public static from(specs: UtilityNodeSpec[]): UtilitySelector
    public static from(name: string, specs: UtilityNodeSpec[]): UtilitySelector
    public static from(nameOrSpecs: string | UtilityNodeSpec[], possiblySpecs?: UtilityNodeSpec[]): UtilitySelector {
        const name = typeof nameOrSpecs === "string" ? nameOrSpecs : "";
        const specs = Array.isArray(nameOrSpecs) ? nameOrSpecs : possiblySpecs!;
        const composite = new UtilitySelector(name);
        composite.setUtilityNodes(specs);
        return composite;
    }

    public setUtilityNodes(specs: UtilityNodeSpec[]): void {
        this.clearNodes();
        this.specs = specs;
        for (const spec of specs) {
            this.addNode(spec.node);
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

    protected override onAbort(ctx: TickContext): void {
        this.currentlyRunningIndex = undefined;
        super.onAbort(ctx);
    }
}
