import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export type RequireSustainedSuccessState = number;


export class RequireSustainedSuccess extends Decorator {
    public override readonly defaultName = "RequireSustainedSuccess";
    private firstSuccessAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly requireSustainedSuccess: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful, NodeFlags.TimeBased);
    }

    private get successDuration(): number {
        if (this.firstSuccessAt === undefined) {
            return 0;
        }
        return Math.max(0, this.lastNow - this.firstSuccessAt);
    }

    public override get displayName(): string {
        return `RequireSustainedSuccess${this.successDuration < this.requireSustainedSuccess ? ` (${this.requireSustainedSuccess - this.successDuration} left)` : ""}`;
    }

    public override getDisplayState(): RequireSustainedSuccessState {
        return Math.max(0, this.requireSustainedSuccess - this.successDuration);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded) {
            if (this.firstSuccessAt === undefined) {
                this.firstSuccessAt = this.lastNow;
            }

            if (this.successDuration >= this.requireSustainedSuccess) {
                return NodeResult.Succeeded;
            }

            // Still requiring sustained success
            return NodeResult.Failed;
        }

        // Reset sustained success timer if it fails or runs
        this.firstSuccessAt = undefined;
        return result;
    }
}
