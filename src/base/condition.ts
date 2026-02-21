import { BTNode } from "./node";
import { NodeResult, NodeType } from "./types";

export class Condition extends BTNode {
    public readonly NODE_TYPE: NodeType = "Condition";

    constructor(name: string, private readonly condition?: () => boolean) {
        super(name);
    }

    protected override onTick(): NodeResult {
        if (!this.condition) {
            throw new Error(`Condition ${this.name} has no condition specified`);
        }

        return this.condition() ? NodeResult.Succeeded : NodeResult.Failed;
    }
}