import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export type DelayState = {
    remainingDelay: number;
};

export class Delay extends Decorator {
    public override readonly defaultName = "Delay";
    private startTime: number | undefined = undefined;
    private lastNow: number = 0;

    constructor(child: BTNode, public delayDuration: number) {
        super(child);
        this.addFlags(NodeFlags.Stateful, NodeFlags.TimeBased);
    }

    public override get displayName(): string {
        return `Delay (${this.remainingTime})`;
    }

    public override getDisplayState(): DelayState {
        return { remainingDelay: Math.max(0, this.remainingTime) };
    }

    private get remainingTime(): number {
        if (this.startTime === undefined) {
            return this.delayDuration;
        }
        return this.delayDuration - (this.lastNow - this.startTime);
    }

    protected override onReset(_ctx: TickContext): void {
        this.startTime = undefined;
        this.lastNow = 0;
    }

    protected override onEnter(ctx: TickContext): void {
        this.startTime = ctx.now;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.remainingTime > 0) {
            return NodeResult.Running;
        }

        return BTNode.Tick(this.child, ctx);
    }
}
