import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

/**
 * Repeats the child until it returns Succeeded, then returns Succeeded.
 *
 * This is a common looping pattern in BT literature (Ögren's "Repeat until success").
 * Useful for retry-like behavior where you want to keep trying until something works.
 *
 * - Child returns Succeeded → Return Succeeded (loop complete)
 * - Child returns Running → Return Running (wait for child)
 * - Child returns Failed → Abort child, return Running (loop continues)
 */
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
            // Abort child to reset its state for the next iteration
            BTNode.Abort(this.child, ctx);
            return NodeResult.Running;
        }

        return NodeResult.Running;
    }
}
