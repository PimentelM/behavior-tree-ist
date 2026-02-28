import { BTNode, Decorator, NodeResult, TickContext } from "../../base";

export class NonAbortable extends Decorator {
    public override readonly defaultName = "NonAbortable";

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onAbort(_ctx: TickContext): void {
        // Intentionally swallow abort propagation to shield the wrapped subtree.
    }
}
