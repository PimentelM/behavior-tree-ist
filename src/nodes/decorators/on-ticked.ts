import { BTNode, Decorator, NodeResult, TickContext } from "../../base";

export class OnTicked extends Decorator {
    constructor(child: BTNode, private cb: (result: NodeResult, ctx: TickContext) => void) {
        super(child);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onTicked(result: NodeResult, ctx: TickContext): void {
        this.cb(result, ctx);
    }
}
