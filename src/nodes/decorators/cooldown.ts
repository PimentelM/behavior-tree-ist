import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, SerializableState } from "../../base/types";

export class Cooldown extends Decorator {
    public override name = "Cooldown";
    private lastFinishedAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly cooldownMs: number,
        private options: { resetOnAbort?: boolean } = {}
    ) {
        super(child);
    }

    private get remainingCooldownMs(): number {
        if (this.lastFinishedAt === undefined) {
            return 0;
        }
        return Math.max(0, this.cooldownMs - (this.lastNow - this.lastFinishedAt));
    }

    public override get displayName(): string {
        return `Cooldown${this.remainingCooldownMs > 0 ? ` (${this.remainingCooldownMs}ms)` : ""}`;
    }

    private hasCooldown(): boolean {
        return this.remainingCooldownMs > 0;
    }

    protected override onAbort(ctx: TickContext): void {
        if (this.options.resetOnAbort) {
            this.lastFinishedAt = undefined;
            this.lastNow = 0;
        }
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasCooldown()) {
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);

        // Cooldown starts only when the child finishes (Success or Failed)
        if (result === NodeResult.Succeeded || result === NodeResult.Failed) {
            this.lastFinishedAt = this.lastNow;
        }

        return result;
    }
}
