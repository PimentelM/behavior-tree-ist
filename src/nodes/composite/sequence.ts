import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class Sequence extends Composite {
    public override readonly defaultName = "Sequence";

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Sequence);
    }

    public static from(nodes: BTNode[]): Sequence
    public static from(name: string, nodes: BTNode[]): Sequence
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): Sequence {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new Sequence(name);
        composite.setNodes(nodes);
        return composite;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`Sequence node ${this.name} has no nodes`);
        }

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const status = BTNode.Tick(node, ctx);
            if (status === NodeResult.Failed || status === NodeResult.Running) {
                this.abortChildrenFrom(i + 1, ctx);
                return status;
            }
        }

        return NodeResult.Succeeded;
    }
}

export const ReactiveSequence = Sequence;
