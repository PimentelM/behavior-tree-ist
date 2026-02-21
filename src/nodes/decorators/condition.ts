import { NodeResult } from "../../base";
import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";

export class Condition extends Decorator {

    constructor(child: BTNode, public override name: string, public readonly condition: () => boolean) {
        super(child);
    }

    protected onTick(ctx: TickContext): NodeResult {
        if (this.condition()) {
            return BTNode.Tick(this.child, ctx);
        }

        return NodeResult.Failed;
    }
}
