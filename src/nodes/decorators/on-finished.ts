import { BTNode, Decorator, NodeResult, NodeFlags, TickContext } from "../../base";

export class OnFinished extends Decorator {
    public override readonly defaultName = "OnFinished";

    constructor(child: BTNode, private cb: (result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext) => void) {
        super(child);
        this.addFlags(NodeFlags.Lifecycle);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onFinished(result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext): void {
        this.cb(result, ctx);
    }
}
