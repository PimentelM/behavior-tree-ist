import { Decorator } from "../../base/decorator";
import { BTNode, type TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class SkipOnFail extends Decorator {
    public override readonly defaultName = "SkipOnFail";

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.ResultTransformer);
    }

    protected onTick(ctx: TickContext): NodeResult {
        const result = BTNode.Tick(this.child, ctx);
        if (result === NodeResult.Failed) return NodeResult.Skipped;
        return result;
    }
}
