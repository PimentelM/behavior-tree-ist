import { BTNode, Decorator, NodeResult, NodeFlags, TickContext } from "../../base";

export class OnReset extends Decorator {
    public override readonly defaultName = "OnReset";

    constructor(child: BTNode, private cb: (ctx: TickContext) => void) {
        super(child);
        this.addFlags(NodeFlags.Lifecycle);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onReset(ctx: TickContext): void {
        this.cb(ctx);
    }
}
