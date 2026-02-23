import { BTNode, Decorator, NodeResult, TickContext } from "../../base";

export class OnFailedOrRunning extends Decorator {
    constructor(child: BTNode, private cb: (ctx: TickContext) => void) {
        super(child);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onFailedOrRunning(ctx: TickContext): void {
        this.cb(ctx);
    }
}
