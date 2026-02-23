import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class FailIf extends Decorator {
    public override readonly defaultName = "FailIf";

    constructor(child: BTNode, public override name: string, public readonly condition: (ctx: TickContext) => boolean) {
        super(child);
        this.addFlags(NodeFlags.Guard);
    }

    protected onTick(ctx: TickContext): NodeResult {
        if (this.condition(ctx)) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        return BTNode.Tick(this.child, ctx);
    }
}
