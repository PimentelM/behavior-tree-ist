import { BTNode, Decorator, NodeResult, TickContext } from "../../base";

export class OnFinished extends Decorator {
    constructor(child: BTNode, private cb: (result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext) => void) {
        super(child);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    protected override onFinished(result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext): void {
        this.cb(result, ctx);
    }
}
