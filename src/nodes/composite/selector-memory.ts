import { Composite } from "../../base/composite";
import { NodeResult, NodeType, SerializableState } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class SelectorMemory extends Composite {
    public readonly NODE_TYPE: NodeType = "SelectorMemory";
    private runningChildIndex: number | undefined;

    public static from(nodes: BTNode[]): SelectorMemory
    public static from(name: string, nodes: BTNode[]): SelectorMemory
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): SelectorMemory {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new SelectorMemory(name);
        composite.setNodes(nodes);
        return composite;
    }

    public override getState(): SerializableState {
        return { runningChildIndex: this.runningChildIndex };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`SelectorMemory node ${this.name} has no nodes`);
        }

        const startIndex = this.runningChildIndex ?? 0;

        for (let i = startIndex; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);

            if (status === NodeResult.Running) {
                this.runningChildIndex = i;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Running;
            }

            if (status === NodeResult.Succeeded) {
                this.runningChildIndex = undefined;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Succeeded;
            }
        }

        this.runningChildIndex = undefined;
        return NodeResult.Failed;
    }

    protected override onAbort(ctx: TickContext): void {
        this.runningChildIndex = undefined;
        super.onAbort(ctx);
    }
}
