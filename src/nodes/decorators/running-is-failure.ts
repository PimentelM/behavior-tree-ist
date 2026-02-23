import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class RunningIsFailure extends Decorator {
    public override name = "RunningIsFailure";

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }
        return status;
    }
}
