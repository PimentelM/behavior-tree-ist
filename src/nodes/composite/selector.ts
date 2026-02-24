import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class Selector extends Composite {
    public override readonly defaultName = "Selector";

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector);
    }

    public static from(nodes: BTNode[]): Selector
    public static from(name: string, nodes: BTNode[]): Selector
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): Selector {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new Selector(name);
        composite.setNodes(nodes);
        return composite;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`Selector node ${this.name} has no nodes`);
        }

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const status = BTNode.Tick(node, ctx);
            if (status === NodeResult.Succeeded || status === NodeResult.Running) {
                this.abortRunningChildrenFrom(i + 1, ctx);
                return status;
            }
        }

        return NodeResult.Failed;
    }
}

export const Fallback = Selector;