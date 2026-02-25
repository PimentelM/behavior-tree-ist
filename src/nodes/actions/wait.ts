import { TickContext } from "../../base";
import { Action } from "../../base/action";
import { NodeResult, NodeFlags } from "../../base/types";
export type WaitActionState = {
    remainingTime: number;
};


export class WaitAction extends Action {
    public override readonly defaultName = "WaitAction";

    constructor(public duration: number) {
        super();
        this.addFlags(NodeFlags.Stateful);
    }

    public override get displayName(): string {
        return `Wait (${this.remainingTime})`;
    }

    public override getDisplayState(): WaitActionState {
        return { remainingTime: Math.max(0, this.remainingTime) };
    }

    private get remainingTime(): number {
        if (this.startTime === undefined) {
            return this.duration;
        }
        return this.duration - (this.lastNow - this.startTime);
    }

    private startTime: number | undefined = undefined;
    private lastNow: number = 0;

    protected override onReset(): void {
        this.startTime = undefined;
        this.lastNow = 0;
    }

    protected override onEnter(ctx: TickContext): void {
        this.startTime = ctx.now;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (this.remainingTime <= 0) {
            return NodeResult.Succeeded;
        }

        return NodeResult.Running;
    }
}
