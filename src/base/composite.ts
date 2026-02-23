import { BTNode, TickContext } from "./node";
import { NodeFlags } from "./types";

export abstract class Composite extends BTNode {
    public readonly defaultName: string = "Composite";

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Composite);
    }

    protected readonly _nodes: BTNode[] = [];
    public get nodes(): ReadonlyArray<BTNode> {
        return this._nodes;
    }

    public override getChildren(): BTNode[] {
        return this._nodes;
    }


    /** Abort only children that were actually Running */
    protected abortRunningChildrenFrom(startIndexInclusive: number, ctx: TickContext): void {
        for (let i = startIndexInclusive; i < this._nodes.length; i++) {
            const node = this._nodes[i];
            if (node.wasRunning) {
                BTNode.Abort(node, ctx);
            }
        }
    }

    /** Abort only children that were actually Running, except one */
    protected abortRunningChildrenExcept(indexToKeep: number, ctx: TickContext): void {
        for (let i = 0; i < this._nodes.length; i++) {
            if (i === indexToKeep) continue;
            const node = this._nodes[i];
            if (node.wasRunning) {
                BTNode.Abort(node, ctx);
            }
        }
    }

    /** Abort all children that were actually Running */
    protected abortAllRunningChildren(ctx: TickContext): void {
        this.abortRunningChildrenFrom(0, ctx);
    }

    protected override onAbort(ctx: TickContext): void {
        this.abortAllRunningChildren(ctx);
    }

    public clearNodes(): void {
        this._nodes.length = 0;
    }

    public addNode(node: BTNode): void {
        this._nodes.push(node);
    }

    public setNodes(nodes: BTNode[]): void {
        this.clearNodes();
        for (const node of nodes) {
            this.addNode(node);
        }
    }
}
