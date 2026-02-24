import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class Timeout extends Decorator {
    public override readonly defaultName = "Timeout";


    constructor(child: BTNode, public readonly timeout: number) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    public override get displayName(): string {
        return `Timeout (${this.remaining})`;
    }

    public override getDisplayState() {
        return { remaining: this.remaining };
    }

    private get elapsed(): number {
        if (this.startedAt === undefined) {
            return 0;
        }
        return this.lastNow - this.startedAt;
    }

    private get remaining(): number {
        return Math.max(0, this.timeout - this.elapsed);
    }

    private startedAt: number | undefined;
    private lastNow: number = 0;

    protected override onEnter(ctx: TickContext): void {
        this.startedAt = ctx.now;
    }

    protected override onReset(): void {
        this.startedAt = undefined;
        this.lastNow = 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        // If child was Running last tick, check if we timed out.
        if (this.wasRunning && this.elapsed >= this.timeout) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        return result;
    }
}
