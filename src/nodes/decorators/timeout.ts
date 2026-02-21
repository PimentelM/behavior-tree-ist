import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult } from "../../base/types";

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
        return Date.now() - this.startedAtMs;
    }

    private get remainingMs(): number {
        return Math.max(0, this.timeoutMs - this.elapsedMs);
    }


    private lastChildResult: NodeResult | undefined = undefined;
    private startedAtMs: number | undefined;

    protected override onAbort(ctx: TickContext): void {
        this.lastChildResult = undefined;
        this.startedAtMs = undefined;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.lastChildResult !== NodeResult.Running) {
            this.startedAtMs = Date.now();
        }

        // If last result was running, check if we timed out
        if (this.lastChildResult === NodeResult.Running && this.elapsedMs >= this.timeoutMs) {
            this.lastChildResult = undefined;
            return NodeResult.Failed;
        }

        const result = BTNode.Tick(this.child, ctx);
        this.lastChildResult = result;
        return result;
    }
}

