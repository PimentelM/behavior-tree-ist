import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class AlwaysFail extends Decorator {
    public override name = "AlwaysFail";

    protected override onTick(ctx: TickContext): NodeResult {
        const status = BTNode.Tick(this.child, ctx);
        if (status === NodeResult.Running) {
            return status;
        }
        return NodeResult.Failed;
    }
}