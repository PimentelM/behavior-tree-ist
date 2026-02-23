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

    private lastChildResult: NodeResult | undefined = undefined;
    private startedAtMs: number | undefined;
    private lastNow: number = 0;

    protected override onReset(): void {
        this.lastChildResult = undefined;
        this.startedAtMs = undefined;
        this.lastNow = 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.lastChildResult !== NodeResult.Running) {
            this.startedAtMs = ctx.now;
        }

        // If last result was running, check if we timed out.
        // Note: lastChildResult is not cleared here — onReset (called by BTNode.Tick
        // after this returns Failed) handles the cleanup of all stateful fields.
        if (this.lastChildResult === NodeResult.Running && this.elapsedMs >= this.timeoutMs) {
            BTNode.Abort(this.child, ctx);
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        this.lastChildResult = result;
        return result;
    }
}
