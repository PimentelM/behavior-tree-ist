import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

/**
 * A decorator that gates child execution based on a condition predicate.
 * If the condition returns true, the child is ticked and its result returned.
 * If the condition returns false, the child is aborted and Failed is returned.
 *
 * This implements the classical "condition guard" pattern from Ögren's BT formalism.
 */
export class Precondition extends Decorator {
    public override readonly defaultName = "Precondition";

    constructor(child: BTNode, public override name: string, public readonly condition: (ctx: TickContext) => boolean) {
        super(child);
        this.addFlags(NodeFlags.Guard);
    }

    protected onTick(ctx: TickContext): NodeResult {
        if (this.condition(ctx)) {
            return BTNode.Tick(this.child, ctx);
        }

        BTNode.Abort(this.child, ctx);
        return NodeResult.Failed;
    }
}
