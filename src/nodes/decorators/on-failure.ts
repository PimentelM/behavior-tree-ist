import { BTNode, Decorator, NodeResult, TickContext } from "../../base";

export class OnFailure extends Decorator {
    constructor(child: BTNode, private cb: (ctx: TickContext) => void) {
        super(child);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onFailed(ctx: TickContext): void {
        this.cb(ctx);
    }
}