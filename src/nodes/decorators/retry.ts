import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class Retry extends Decorator {
    public override name = "Retry";
    private failedCount: number = 0;

    constructor(
        child: BTNode,
        public readonly maxRetries: number = -1, // -1 for infinite
        private options: { resetOnAbort?: boolean } = {}
    ) {
        super(child);
    }

    public override get displayName(): string {
        if (this.maxRetries === -1) {
            return "Retry (Infinite)";
        }
        return `Retry (${this.failedCount}/${this.maxRetries})`;
    }

    protected override onAbort(ctx: TickContext): void {
        if (this.options.resetOnAbort) {
            this.failedCount = 0;
        }
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.maxRetries !== -1 && this.failedCount > this.maxRetries) {
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Failed) {
            this.failedCount++;
            if (this.maxRetries !== -1 && this.failedCount > this.maxRetries) {
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
