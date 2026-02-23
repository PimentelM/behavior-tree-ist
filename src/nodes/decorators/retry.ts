import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class Retry extends Decorator {
    public override readonly defaultName = "Retry";
    private failedCount: number = 0;

    constructor(
        child: BTNode,
        public readonly maxRetries: number = -1, // -1 for infinite
    ) {
        super(child);
        this.addFlags(NodeFlags.Repeating, NodeFlags.Stateful);
    }

    public override get displayName(): string {
        if (this.maxRetries === -1) {
            return "Retry (Infinite)";
        }
        return `Retry (${this.failedCount}/${this.maxRetries})`;
    }

    protected override onReset(): void {
        this.failedCount = 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.maxRetries !== -1 && this.failedCount >= this.maxRetries) {
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Failed) {
            this.failedCount++;
            if (this.maxRetries !== -1 && this.failedCount >= this.maxRetries) {
                return NodeResult.Failed;
            }

            // We caught the failure and are retrying. Return Running to our parent.
            // No need to Abort the child since it already gracefully failed.
            return NodeResult.Running;
        }

        if (result === NodeResult.Succeeded) {
            return NodeResult.Succeeded;
        }

        return NodeResult.Running;
    }
}
