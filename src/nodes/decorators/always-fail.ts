import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class AlwaysFail extends Decorator {
    public override readonly defaultName = "AlwaysFail";

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.ResultTransformer);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            return status;
        }
        return NodeResult.Failed;
    }
}