import { TickContext } from "../../base";
import { Action } from "../../base/action";
import { NodeResult } from "../../base/types";

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
        return this.duration - (Date.now() - this.startTime);
    }

    private startTime: number | undefined = undefined;

    protected override onAbort(ctx: TickContext): void {
        this.startTime = undefined;
    }

    protected override onTick(): NodeResult {
        if (!this.startTime) {
            this.startTime = Date.now();
        }

        if (this.remainingTime <= 0) {
            this.startTime = undefined;
            return NodeResult.Succeeded;
        }

        return NodeResult.Running;
    }
}