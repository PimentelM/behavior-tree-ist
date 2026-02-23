import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags, SerializableState } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class MemorySelector extends Composite {
    public override readonly defaultName = "MemorySelector";
    private _runningChildIndex: number | undefined;

    public get runningChildIndex(): number | undefined {
        return this._runningChildIndex;
    }

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector, NodeFlags.Memory);
    }

    public static from(nodes: BTNode[]): MemorySelector
    public static from(name: string, nodes: BTNode[]): MemorySelector
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): MemorySelector {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new MemorySelector(name);
        composite.setNodes(nodes);
        return composite;
    }

    public override getDisplayState(): SerializableState {
        return { runningChildIndex: this._runningChildIndex };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`MemorySelector node ${this.name} has no nodes`);
        }

        const startIndex = this._runningChildIndex ?? 0;

        for (let i = startIndex; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);

            if (status === NodeResult.Running) {
                this._runningChildIndex = i;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Running;
            }

            if (status === NodeResult.Succeeded) {
                this._runningChildIndex = undefined;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Succeeded;
            }
        }

        this._runningChildIndex = undefined;
        return NodeResult.Failed;
    }

    protected override onAbort(ctx: TickContext): void {
        this._runningChildIndex = undefined;
        super.onAbort(ctx);
    }
}
