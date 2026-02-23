import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class Repeat extends Decorator {
    public override readonly defaultName = "Repeat";
    private successfulCount: number = 0;

    constructor(
        child: BTNode,
        public readonly times: number = -1, // -1 for infinite
    ) {
        super(child);
        this.addFlags(NodeFlags.Repeating, NodeFlags.Stateful);
    }

    public override get displayName(): string {
        if (this.times === -1) {
            return "Repeat (Infinite)";
        }
        return `Repeat (${this.successfulCount}/${this.times})`;
    }

    protected override onAbort(ctx: TickContext): void {
        this.successfulCount = 0;
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.times !== -1 && this.successfulCount >= this.times) {
            return NodeResult.Succeeded;
        }

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded) {
            this.successfulCount++;
            if (this.times !== -1 && this.successfulCount >= this.times) {
                return NodeResult.Succeeded;
            }

            // Abort child to reset its state for the next internal loop if we're repeating
            BTNode.Abort(this.child, ctx);
            return NodeResult.Running;
        }

        if (result === NodeResult.Failed) {
            return NodeResult.Failed;
        }

        return NodeResult.Running;
    }
}
