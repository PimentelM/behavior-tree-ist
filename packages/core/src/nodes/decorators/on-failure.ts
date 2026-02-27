import { BTNode, Decorator, NodeResult, NodeFlags, TickContext } from "../../base";

export class OnFailure extends Decorator {
    public override readonly defaultName = "OnFailure";

    constructor(child: BTNode, private cb: (ctx: TickContext) => void) {
        super(child);
        this.addFlags(NodeFlags.Lifecycle);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onFailed(ctx: TickContext): void {
        this.cb(ctx);
    }
}