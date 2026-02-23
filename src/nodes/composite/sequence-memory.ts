import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags, SerializableState } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export class SequenceMemory extends Composite {
    public override readonly defaultName = "SequenceMemory";
    private _runningChildIndex: number | undefined;

    public get runningChildIndex(): number | undefined {
        return this._runningChildIndex;
    }

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Sequence, NodeFlags.Memory);
    }

    public static from(nodes: BTNode[]): SequenceMemory
    public static from(name: string, nodes: BTNode[]): SequenceMemory
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[]): SequenceMemory {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new SequenceMemory(name);
        composite.setNodes(nodes);
        return composite;
    }

    public override getDisplayState(): SerializableState {
        return { runningChildIndex: this._runningChildIndex };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`SequenceMemory node ${this.name} has no nodes`);
        }

        const startIndex = this._runningChildIndex ?? 0;

        for (let i = startIndex; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);

            if (status === NodeResult.Running) {
                this._runningChildIndex = i;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Running;
            }

            if (status === NodeResult.Failed) {
                this._runningChildIndex = undefined;
                this.abortChildrenFrom(i + 1, ctx);
                return NodeResult.Failed;
            }
        }

        this._runningChildIndex = undefined;
        return NodeResult.Succeeded;
    }

    protected override onAbort(ctx: TickContext): void {
        this._runningChildIndex = undefined;
        super.onAbort(ctx);
    }
}
