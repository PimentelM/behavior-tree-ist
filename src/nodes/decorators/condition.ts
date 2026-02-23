import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, SerializableState } from "../../base/types";

export class Condition extends Decorator {
    private lastChildResult: NodeResult | undefined;

    constructor(child: BTNode, public override name: string, public readonly condition: (ctx: TickContext) => boolean) {
        super(child);
    }

    public override getState(): SerializableState {
        return { lastChildResult: this.lastChildResult };
    }

    protected onTick(ctx: TickContext): NodeResult {
        if (this.condition(ctx)) {
            const result = BTNode.Tick(this.child, ctx);
            this.lastChildResult = result;
            return result;
        }

        if (this.lastChildResult === NodeResult.Running) {
            BTNode.Abort(this.child, ctx);
        }
        this.lastChildResult = undefined;
        return NodeResult.Failed;
    }

    protected override onAbort(ctx: TickContext): void {
        this.lastChildResult = undefined;
        super.onAbort(ctx);
    }
}
