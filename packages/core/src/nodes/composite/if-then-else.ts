import { Composite } from "../../base/composite";
import { NodeResult } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class IfThenElse extends Composite {
    public override readonly defaultName = "IfThenElse";

    constructor(name?: string) {
        super(name);
    }

    public static from(nodes: [BTNode, BTNode] | [BTNode, BTNode, BTNode]): IfThenElse
    public static from(name: string, nodes: [BTNode, BTNode] | [BTNode, BTNode, BTNode]): IfThenElse
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): IfThenElse {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new IfThenElse(name);
        composite.setNodes(nodes);
        return composite;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length < 2 || this.nodes.length > 3) {
            throw new Error(`IfThenElse node ${this.name} must have 2 or 3 children`);
        }

        const conditionNode = this.nodes[0];
        const thenNode = this.nodes[1];
        const elseNode = this.nodes[2]; // Might be undefined

        const conditionResult = BTNode.Tick(conditionNode, ctx);

        if (conditionResult === NodeResult.Running) {
            if (thenNode.wasRunning) {
                BTNode.Abort(thenNode, ctx);
            }
            if (elseNode && elseNode.wasRunning) {
                BTNode.Abort(elseNode, ctx);
            }
            return NodeResult.Running;
        }

        if (conditionResult === NodeResult.Succeeded) {
            if (elseNode && elseNode.wasRunning) {
                BTNode.Abort(elseNode, ctx);
            }
            return BTNode.Tick(thenNode, ctx);
        }

        // conditionResult === NodeResult.Failed
        if (thenNode.wasRunning) {
            BTNode.Abort(thenNode, ctx);
        }

        if (elseNode) {
            return BTNode.Tick(elseNode, ctx);
        }

        return NodeResult.Failed;
    }
}
