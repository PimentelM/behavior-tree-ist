import { BTNode } from "./node";
import { NodeResult, NodeType } from "./types";

export abstract class Action extends BTNode {
    public readonly NODE_TYPE: NodeType = "Action";

    static from(name: string, fn: () => NodeResult): Action {
        class LambdaAction extends Action {
            public override name = name;
            protected override onTick(): NodeResult {
                return fn();
            }
        }
        return new LambdaAction();
    }
}
