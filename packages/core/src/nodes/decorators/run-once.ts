import { Decorator } from "../../base/decorator";
import { BTNode, TickContext } from "../../base/node";
import { NodeResult, NodeFlags } from "../../base/types";

export type RunOnceState = NodeResult | null;

export class RunOnce extends Decorator {
    public override readonly defaultName = "RunOnce";
    private completedResult: NodeResult | null = null;

    constructor(child: BTNode) {
        super(child);
        this.addFlags(NodeFlags.Stateful);
    }

    public forceReset(): void {
        this.completedResult = null;
    }

    public override getDisplayState(): RunOnceState {
        return this.completedResult;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.completedResult !== null) {
            return this.completedResult;
        }

        const result = BTNode.Tick(this.child, ctx);

        if (result === NodeResult.Succeeded || result === NodeResult.Failed) {
            this.completedResult = result;
        }

        return result;
    }


}
