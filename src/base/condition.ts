import { BTNode, TickContext } from "./node";
import { NodeResult, NodeType } from "./types";

export abstract class ConditionNode extends BTNode {
    public readonly NODE_TYPE: NodeType = "Condition";

    public static from(name: string, condition: (ctx: TickContext) => boolean): ConditionNode {
        return new class LambdaCondition extends ConditionNode {
            constructor() {
                super(name, condition);
            }
        };
    }

    constructor(name: string, private readonly condition: (ctx: TickContext) => boolean) {
        super(name);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return this.condition(ctx) ? NodeResult.Succeeded : NodeResult.Failed;
    }
}
