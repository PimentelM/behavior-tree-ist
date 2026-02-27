import { BTNode, TickContext } from "../../base/node";
import { Decorator } from "../../base/decorator";
import { UtilityScorer } from "../../base/utility";
import { NodeFlags, NodeResult } from "../../base";

export type UtilityState = {
    lastScore: number;
}
export class Utility extends Decorator {
    public override readonly defaultName = "Utility";
    private _lastScore: number = -1;

    constructor(child: BTNode, private readonly scorer: UtilityScorer) {
        super(child);
        this.addFlags(NodeFlags.Utility, NodeFlags.Stateful);
    }

    public override getDisplayState(): UtilityState {
        return {
            lastScore: this._lastScore
        };
    }

    public getScore(ctx: TickContext): number {
        this._lastScore = this.scorer(ctx);
        return this._lastScore;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }
}
