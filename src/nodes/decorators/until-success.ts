import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class UntilSuccess extends Decorator {
    public override readonly defaultName = "UntilSuccess";

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.Repeating);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded) {
            return NodeResult.Succeeded;
        }

        if (result === NodeResult.Failed) {
            // Child state already reset via onReset (triggered by Tick).
            // Abort is a no-op if child was never Running.
            BTNode.Abort(this.child, ctx);
            return NodeResult.Running;
        }

        return NodeResult.Running;
    }
}
