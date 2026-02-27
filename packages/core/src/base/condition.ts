import { BTNode, TickContext } from "./node";
import { NodeResult, NodeFlags } from "./types";

export abstract class ConditionNode extends BTNode {
    public readonly defaultName: string = "Condition";

    public static from(name: string, condition: (ctx: TickContext) => boolean): ConditionNode {
        return new class LambdaCondition extends ConditionNode {
            constructor() {
                super(name, condition);
            }
        };
    }

    constructor(name: string, private readonly condition: (ctx: TickContext) => boolean) {
        super(name);
        this.addFlags(NodeFlags.Leaf, NodeFlags.Condition);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return this.condition(ctx) ? NodeResult.Succeeded : NodeResult.Failed;
    }
}
