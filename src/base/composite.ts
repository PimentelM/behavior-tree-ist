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

    protected abortChildrenFrom(startIndexInclusive: number, ctx: TickContext): void {
        for (let i = startIndexInclusive; i < this._nodes.length; i++) {
            const node = this._nodes[i];
            BTNode.Abort(node, ctx);
        }
    }

    protected abortChildrenExcept(indexToKeep: number, ctx: TickContext): void {
        for (let i = 0; i < this._nodes.length; i++) {
            if (i === indexToKeep) continue;
            const node = this._nodes[i];
            BTNode.Abort(node, ctx);
        }
    }

    protected abortAllChildren(ctx: TickContext): void {
        this.abortChildrenFrom(0, ctx);
    }

    protected abortChildrenByIndex(indexes: number[], ctx: TickContext): void {
        for (const index of indexes) {
            const node = this._nodes[index];
            if (!node) continue;
            BTNode.Abort(node, ctx);
        }
    }

    protected override onAbort(ctx: TickContext): void {
        this.abortAllChildren(ctx);
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
