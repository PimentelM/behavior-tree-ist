import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class RunningIsSuccess extends Decorator {
    public override readonly defaultName = "RunningIsSuccess";

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.ResultTransformer);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Succeeded;
        }
        return status;
    }
}
