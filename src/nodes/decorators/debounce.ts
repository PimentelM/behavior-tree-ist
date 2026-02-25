import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";
export type DebounceState = {
    remainingDebounce: number;
};


export class Debounce extends Decorator {
    public override readonly defaultName = "Debounce";
    private firstSuccessAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly debounce: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    private get successDuration(): number {
        if (this.firstSuccessAt === undefined) {
            return 0;
        }
        return Math.max(0, this.lastNow - this.firstSuccessAt);
    }

    public override get displayName(): string {
        return `Debounce${this.successDuration < this.debounce ? ` (${this.debounce - this.successDuration} left)` : ""}`;
    }

    public override getDisplayState(): DebounceState {
        return { remainingDebounce: Math.max(0, this.debounce - this.successDuration) };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded) {
            if (this.firstSuccessAt === undefined) {
                this.firstSuccessAt = this.lastNow;
            }

            if (this.successDuration >= this.debounce) {
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
