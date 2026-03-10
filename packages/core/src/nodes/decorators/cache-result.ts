import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export type CacheResultState = {
    remaining: number;
    cachedResult: NodeResult | undefined;
};

export class CacheResult extends Decorator {
    public override readonly defaultName = "CacheResult";
    private lastFinishedAt: number | undefined = undefined;
    private cachedResult: NodeResult | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly cacheDuration: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful, NodeFlags.TimeBased);
    }

    private get remainingCache(): number {
        if (this.lastFinishedAt === undefined) {
            return 0;
        }
        return Math.max(0, this.cacheDuration - (this.lastNow - this.lastFinishedAt));
    }

    public override get displayName(): string {
        return `CacheResult${this.remainingCache > 0 ? ` (${this.remainingCache})` : ""}`;
    }

    public override getDisplayState(): CacheResultState {
        return {
            remaining: this.remainingCache,
            cachedResult: this.cachedResult,
        };
    }

    private hasValidCache(): boolean {
        return this.cachedResult !== undefined && this.remainingCache > 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.hasValidCache()) {
            return this.cachedResult!;
        }

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded || result === NodeResult.Failed) {
            this.cachedResult = result;
            this.lastFinishedAt = this.lastNow;
        }

        return result;
    }
}
