import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

export class HardThrottle extends Decorator {
    public override name = "HardThrottle";
    private lastTriggeredAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly throttleMs: number,
        private options: { resetOnAbort?: boolean } = {}
    ) {
        super(child);
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

    protected override onAbort(ctx: TickContext): void {
        if (this.options.resetOnAbort) {
            this.lastTriggeredAt = undefined;
            this.lastNow = 0;
        }
        super.onAbort(ctx);
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
