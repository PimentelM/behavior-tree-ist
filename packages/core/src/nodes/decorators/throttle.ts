import { NodeResult, NodeFlags } from "../../base/types";
import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";


export type ThrottleState = number;
export class Throttle extends Decorator {
    public override readonly defaultName = "Throttle";

    constructor(child: BTNode, public readonly throttle: number) {
        super(child);
        this.addFlags(NodeFlags.Stateful, NodeFlags.TimeBased);
    }

    private lastTriggeredAt: number | undefined = undefined;
    private lastNow: number = 0;

    private get remainingThrottle(): number {
        if (this.lastTriggeredAt === undefined) {
            return 0;
        }
        return Math.max(0, this.throttle - (this.lastNow - this.lastTriggeredAt));
    }

    public override get displayName(): string {
        return `Throttle${this.remainingThrottle > 0 ? ` (${this.remainingThrottle})` : ""}`;
    }

    public override getDisplayState(): ThrottleState {
        return this.remainingThrottle;
    }

    private hasThrottle(): boolean {
        return this.remainingThrottle > 0;
    }
    private startThrottle(): void {
        this.lastTriggeredAt = this.lastNow;
    }


    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasThrottle() && !this.wasRunning) {
            return NodeResult.Failed;
        }

        if (!this.wasRunning) {
            this.startThrottle();
        }

        const result = BTNode.Tick(this.child, ctx);
        return result;
    }
}
