import { Decorator } from "../../base/decorator";
import { BTNode, type TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class SkipIf extends Decorator {
    public override readonly defaultName = "SkipIf";

    constructor(child: BTNode, public override name: string, public readonly condition: (ctx: TickContext) => boolean) {
        super(child);
        this.addFlags(NodeFlags.Guard);
    }

    protected onTick(ctx: TickContext): NodeResult {
        if (this.condition(ctx)) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Skipped;
        }

        return BTNode.Tick(this.child, ctx);
    }
}
