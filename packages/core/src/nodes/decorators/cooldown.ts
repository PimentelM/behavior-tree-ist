import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";
export type CooldownState = number;


export class Cooldown extends Decorator {
    public override readonly defaultName = "Cooldown";
    private lastFinishedAt: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(
        child: BTNode,
        public readonly cooldown: number,
    ) {
        super(child);
        this.addFlags(NodeFlags.Stateful, NodeFlags.TimeBased);
    }

    private get remainingCooldown(): number {
        if (this.lastFinishedAt === undefined) {
            return 0;
        }
        return Math.max(0, this.cooldown - (this.lastNow - this.lastFinishedAt));
    }

    public override get displayName(): string {
        return `Cooldown${this.remainingCooldown > 0 ? ` (${this.remainingCooldown})` : ""}`;
    }

    public override getDisplayState(): CooldownState {
        return this.remainingCooldown;
    }

    private hasCooldown(): boolean {
        return this.remainingCooldown > 0;
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
