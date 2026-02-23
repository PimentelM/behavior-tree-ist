import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

/**
 * Repeats the child until it returns Failed, then returns Succeeded.
 *
 * This is a common looping pattern in BT literature (Ögren's "Repeat until failure").
 * Useful for actions that should be performed repeatedly until a condition changes.
 *
 * - Child returns Succeeded → Abort child, return Running (loop continues)
 * - Child returns Running → Return Running (wait for child)
 * - Child returns Failed → Return Succeeded (loop complete)
 */
export class UntilFail extends Decorator {
    public override readonly defaultName = "UntilFail";

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
            // Abort child to reset its state for the next iteration
            BTNode.Abort(this.child, ctx);
            return NodeResult.Running;
        }

        return NodeResult.Running;
    }
}
