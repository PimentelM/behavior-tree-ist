import { NodeResult } from "../../base";
import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";

export class Throttle extends Decorator {
    public override name = "Throttle";
    constructor(child: BTNode, public readonly throttleMs: number) {
        super(child);
    }

    private lastTriggeredAt: number = 0;
    private lastNow: number = 0;

    private get remainingThrottleMs(): number {
        return Math.max(0, this.throttleMs - (this.lastNow - this.lastTriggeredAt));
    }

    public override get displayName(): string {
        return `Throttle${this.remainingThrottleMs > 0 ? ` (${this.remainingThrottleMs}ms)` : ""}`;
    }

    private hasThrottle(): boolean {
        return this.remainingThrottleMs > 0;
    }
    private startThrottle(): void {
        this.lastTriggeredAt = this.lastNow;
    }

    private lastChildResult: NodeResult | undefined = undefined;

    protected override onAbort(ctx: TickContext): void {
        this.lastChildResult = undefined;
        this.lastTriggeredAt = 0;
        this.lastNow = 0;
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasThrottle() && this.lastChildResult !== NodeResult.Running) {
            return NodeResult.Failed;
        }

        if (this.lastChildResult !== NodeResult.Running) {
            this.startThrottle();
        }

        const result = BTNode.Tick(this.child, ctx);
        this.lastChildResult = result;
        return result;
    }
}
