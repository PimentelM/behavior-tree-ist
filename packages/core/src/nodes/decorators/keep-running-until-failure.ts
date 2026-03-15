import { Decorator } from "../../base/decorator";
import { BTNode, type TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class KeepRunningUntilFailure extends Decorator {
    public override readonly defaultName = "KeepRunningUntilFailure";

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.Repeating);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Failed) {
            return NodeResult.Succeeded;
        }

        if (result === NodeResult.Succeeded) {
            // No abort needed — BTNode.Tick already cleared child._wasRunning when child returned Succeeded.
            return NodeResult.Running;
        }

        return NodeResult.Running;
    }
}
