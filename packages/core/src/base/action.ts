import { BTNode, TickContext } from "./node";
import { NodeResult, NodeFlags } from "./types";

export abstract class Action extends BTNode {
    public readonly defaultName: string = "Action";

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Leaf, NodeFlags.Action);
    }

    static from(name: string, fn: (ctx: TickContext) => NodeResult): Action {
        class LambdaAction extends Action {
            public override name = name;
            protected override onTick(ctx: TickContext): NodeResult {
                return fn(ctx);
            }
        }
        return new LambdaAction();
    }
}
