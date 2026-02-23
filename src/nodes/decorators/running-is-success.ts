import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class RunningIsSuccess extends Decorator {
    public override name = "RunningIsSuccess";

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Succeeded;
        }
        return status;
    }
}
