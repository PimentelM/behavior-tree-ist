import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, SerializableState } from "../../base/types";

export class Debounce extends Decorator {
    public override name = "Debounce";
    private firstSuccessAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly debounceMs: number,
        private options: { resetOnAbort?: boolean } = {}
    ) {
        super(child);
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

    protected override onAbort(ctx: TickContext): void {
        if (this.options.resetOnAbort) {
            this.firstSuccessAt = undefined;
            this.lastNow = 0;
        }
        super.onAbort(ctx);
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
