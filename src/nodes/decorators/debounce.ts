import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class Debounce extends Decorator {
    public override readonly defaultName = "Debounce";
    private firstSuccessAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly debounceMs: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    private get successDurationMs(): number {
        if (this.firstSuccessAt === undefined) {
            return 0;
        }
        return Math.max(0, this.lastNow - this.firstSuccessAt);
    }

    public override get displayName(): string {
        return `Debounce${this.successDurationMs < this.debounceMs ? ` (${this.debounceMs - this.successDurationMs}ms left)` : ""}`;
    }


    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded) {
            if (this.firstSuccessAt === undefined) {
                this.firstSuccessAt = this.lastNow;
            }

            if (this.successDurationMs >= this.debounceMs) {
                return NodeResult.Succeeded;
            }

            // Still debouncing the success
            return NodeResult.Failed;
        }

        // Reset debounce timer if it fails or runs
        this.firstSuccessAt = undefined;
        return result;
    }
}
