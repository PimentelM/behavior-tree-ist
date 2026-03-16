import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, type TickContext } from "../../base/node";

export class Fallback extends Composite {
    public override readonly defaultName = "Fallback";

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector);
    }

    public static from(nodes: BTNode[]): Fallback
    public static from(name: string, nodes: BTNode[]): Fallback
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): Fallback {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : (possiblyNodes as BTNode[]);
        const composite = new Fallback(name);
        composite.setNodes(nodes);
        return composite;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`Fallback node ${this.displayName} has no nodes`);
        }

        for (const [i, node] of this.nodes.entries()) {
            const status = BTNode.Tick(node, ctx);
            if (status === NodeResult.Succeeded || status === NodeResult.Running) {
                this.abortChildrenFrom(i + 1, ctx);
                return status;
            }
        }

        return NodeResult.Failed;
    }
}

export const ReactiveFallback = Fallback;
export const Selector = Fallback;
