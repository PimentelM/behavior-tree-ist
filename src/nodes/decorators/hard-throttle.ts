import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, SerializableState } from "../../base/types";

export class HardThrottle extends Decorator {
    public override name = "HardThrottle";
    private lastTriggeredAt: number | undefined = undefined;
    private lastNow: number = 0;
    private lastChildResult: NodeResult | undefined = undefined;

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

    public override getState(): SerializableState {
        return {
            lastTriggeredAt: this.lastTriggeredAt,
            lastNow: this.lastNow
        };
    }

    private hasThrottle(): boolean {
        return this.remainingThrottleMs > 0;
    }

    private startThrottle(): void {
        this.lastTriggeredAt = this.lastNow;
    }

    protected override onAbort(ctx: TickContext): void {
        if (this.options.resetOnAbort) {
            this.lastChildResult = undefined;
            this.lastTriggeredAt = undefined;
            this.lastNow = 0;
        }
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasThrottle()) {
            if (this.lastChildResult === NodeResult.Running) {
                // If it was running and we are throttling, we still block execution downward.
                // We must tell the system we are blocking by returning Failed.
                // We also must abort the child so it resets its Running state,
                // because we are violating the contract of continuous ticks for a running node
                // by deliberately starving it of ticks.
                this.lastChildResult = undefined;
                BTNode.Abort(this.child, ctx);
            }
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        this.lastChildResult = result;

        // Start throttle immediately regardless of result.
        this.startThrottle();

        return result;
    }
}
