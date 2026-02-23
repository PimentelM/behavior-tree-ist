import { NodeResult, NodeFlags } from "../../base/types";
import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";

/**
 * A decorator that prevents the child node from being executed more than once within a specified time window.
 * 
 * @param child The child node to execute.
 * @param throttleMs The time window in milliseconds to wait before allowing the child to be executed again.
 */
export class Throttle extends Decorator {
    public override readonly defaultName = "Throttle";

    constructor(child: BTNode, public readonly throttleMs: number) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    private lastTriggeredAt: number | undefined = undefined;
    private lastNow: number = 0;

    private get remainingThrottleMs(): number {
        if (this.lastTriggeredAt === undefined) {
            return 0;
        }
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
