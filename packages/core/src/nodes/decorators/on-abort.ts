import { BTNode, Decorator, NodeResult, NodeFlags, TickContext } from "../../base";

export class OnAbort extends Decorator {
    public override readonly defaultName = "OnAbort";

    constructor(child: BTNode, private cb: (ctx: TickContext) => void) {
        super(child);
        this.addFlags(NodeFlags.Lifecycle);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onAbort(ctx: TickContext): void {
        super.onAbort(ctx);
        this.cb(ctx);
    }
}
