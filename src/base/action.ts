import { BTNode, TickContext } from "./node";
import { NodeResult, NodeType } from "./types";

export abstract class Action extends BTNode {
    public readonly NODE_TYPE: NodeType = "Action";

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
