import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class AlwaysSucceed extends Decorator {
    public override name = "AlwaysSucceed";

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            return status;
        }
        return NodeResult.Succeeded;
    }
}