import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, SerializableState } from "../../base/types";

export class Timeout extends Decorator {
    public override name = "Timeout";


    constructor(child: BTNode, public readonly timeoutMs: number) {
        super(child);
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

    public override getState(): SerializableState {
        return {
            lastChildResult: this.lastChildResult,
            startedAtMs: this.startedAtMs,
            lastNow: this.lastNow
        };
    }


    private lastChildResult: NodeResult | undefined = undefined;
    private startedAtMs: number | undefined;
    private lastNow: number = 0;

    protected override onAbort(ctx: TickContext): void {
        this.lastChildResult = undefined;
        this.startedAtMs = undefined;
        this.lastNow = 0;
        super.onAbort(ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.lastChildResult !== NodeResult.Running) {
            this.startedAtMs = ctx.now;
        }

        // If last result was running, check if we timed out
        if (this.lastChildResult === NodeResult.Running && this.elapsedMs >= this.timeoutMs) {
            this.lastChildResult = undefined;
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        this.lastChildResult = result;
        return result;
    }
}
