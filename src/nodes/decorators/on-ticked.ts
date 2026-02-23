import { BTNode, Decorator, NodeResult, NodeFlags, TickContext } from "../../base";

export class OnTicked extends Decorator {
    public override readonly defaultName = "OnTicked";

    constructor(child: BTNode, private cb: (result: NodeResult, ctx: TickContext) => void) {
        super(child);
        this.addFlags(NodeFlags.Lifecycle);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onTicked(result: NodeResult, ctx: TickContext): void {
        this.cb(result, ctx);
    }
}
