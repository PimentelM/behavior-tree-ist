import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
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
            // Child state already reset via onReset (triggered by Tick).
            // Abort is a no-op if child was never Running.
            BTNode.Abort(this.child, ctx);
            return NodeResult.Running;
        }

        return NodeResult.Running;
    }
}
