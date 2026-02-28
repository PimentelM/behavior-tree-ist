import { BTNode, TickContext } from "../../base/node";
import { Decorator } from "../../base/decorator";
import { UtilityScorer } from "../../base/utility";
import { NodeFlags, NodeResult } from "../../base";

export class Utility extends Decorator {
    public override readonly defaultName = "Utility";

    constructor(child: BTNode, private readonly scorer: UtilityScorer) {
        super(child);
        this.addFlags(NodeFlags.Utility);
    }

    public getScore(ctx: TickContext): number {
        return this.scorer(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }
}
