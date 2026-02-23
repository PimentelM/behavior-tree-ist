import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export class Timeout extends Decorator {
    public override readonly defaultName = "Timeout";


    constructor(child: BTNode, public readonly timeoutMs: number) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    public override get displayName(): string {
        return `Timeout (${this.remainingMs}ms)`;
    }

    private get elapsedMs(): number {
        if (!this.startedAtMs) {
            return 0;
        }
        return this.lastNow - this.startedAtMs;
    }

    private get remainingMs(): number {
        return Math.max(0, this.timeoutMs - this.elapsedMs);
    }

    private startedAtMs: number | undefined;
    private lastNow: number = 0;

    protected override onEnter(ctx: TickContext): void {
        this.startedAtMs = ctx.now;
    }

    protected override onReset(): void {
        this.startedAtMs = undefined;
        this.lastNow = 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        // If child was Running last tick, check if we timed out.
        if (this.wasRunning && this.elapsedMs >= this.timeoutMs) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        return result;
    }
}
