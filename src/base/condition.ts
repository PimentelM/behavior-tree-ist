import { BTNode } from "./node";
import { NodeResult, NodeType } from "./types";

export abstract class Condition extends BTNode {
    public readonly NODE_TYPE: NodeType = "Condition";

    constructor(name: string, private readonly condition: () => boolean) {
        super(name);
    }

    protected override onTick(): NodeResult {
        return this.condition() ? NodeResult.Succeeded : NodeResult.Failed;
    }
}
