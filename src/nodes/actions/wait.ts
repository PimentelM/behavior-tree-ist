import { TickContext } from "../../base";
import { Action } from "../../base/action";
import { NodeResult, SerializableState } from "../../base/types";

export class WaitAction extends Action {
    public override name = "WaitAction";

    constructor(public duration: number) {
        super();
    }

    public override get displayName(): string {
        return `Wait (${this.remainingTime}ms)`;
    }

    private get remainingTime(): number {
        if (!this.startTime) {
            return this.duration;
        }
        return this.duration - (this.lastNow - this.startTime);
    }

    public override getState(): SerializableState {
        return {
            startTime: this.startTime,
            lastNow: this.lastNow
        };
    }

    private startTime: number | undefined = undefined;
    private lastNow: number = 0;

    protected override onAbort(): void {
        this.startTime = undefined;
        this.lastNow = 0;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.lastNow = ctx.now;

        if (!this.startTime) {
            this.startTime = ctx.now;
        }

        if (this.remainingTime <= 0) {
            this.startTime = undefined;
            return NodeResult.Succeeded;
        }

        return NodeResult.Running;
    }
}
