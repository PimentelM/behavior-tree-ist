import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

/**
 * A decorator that prevents the child node from being executed more than once within a specified time window.
 * Throttles even running nodes.
 * 
 * @param child The child node to execute.
 * @param throttleMs The time window in milliseconds to wait before allowing the child to be executed again.
 */
export class HardThrottle extends Decorator {
    public override readonly defaultName = "HardThrottle";
    private lastTriggeredAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly throttleMs: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    private get remainingThrottleMs(): number {
        if (this.lastTriggeredAt === undefined) {
            return 0;
        }
        return Math.max(0, this.throttleMs - (this.lastNow - this.lastTriggeredAt));
    }

    public override get displayName(): string {
        return `HardThrottle${this.remainingThrottleMs > 0 ? ` (${this.remainingThrottleMs}ms)` : ""}`;
    }

    private hasThrottle(): boolean {
        return this.remainingThrottleMs > 0;
    }

    private startThrottle(): void {
        this.lastTriggeredAt = this.lastNow;
    }


    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasThrottle()) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);

        // Start throttle immediately regardless of result.
        this.startThrottle();

        return result;
    }
}
