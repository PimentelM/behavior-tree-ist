import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";
import { Utility } from "../decorators/utility";

export class UtilitySequence extends Composite {
    public override readonly defaultName = "UtilitySequence";
    private currentlyRunningIndex: number | undefined = undefined;
    private scoreBuffer: { index: number; score: number }[] = [];

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Sequence, NodeFlags.Utility, NodeFlags.Stateful);
    }

    public static from(nodes: Utility[]): UtilitySequence
    public static from(name: string, nodes: Utility[]): UtilitySequence
    public static from(nameOrNodes: string | Utility[], possiblyNodes?: Utility[]): UtilitySequence {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "UtilitySequence";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new UtilitySequence(name);
        composite.setNodes(nodes);
        return composite;
    }


    public override addNode(node: Utility): this {
        if (!(node instanceof Utility)) {
            throw new Error(`UtilitySequence ${this.name} only accepts Utility nodes as children.`);
        }
        super.addNode(node);
        this.scoreBuffer.push({ index: this.nodes.length - 1, score: 0 });
        return this;
    }

    public override setNodes(nodes: Utility[]): this {
        for (const node of nodes) {
            if (!(node instanceof Utility)) {
                throw new Error(`UtilitySequence ${this.name} only accepts Utility nodes as children.`);
            }
        }
        super.setNodes(nodes);
        this.scoreBuffer = nodes.map((_, i) => ({ index: i, score: 0 }));
        return this;
    }

    public override clearNodes(): this {
        super.clearNodes();
        this.scoreBuffer = [];
        return this;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`UtilitySequence node ${this.name} has no nodes`);
        }

        // Evaluate scores every tick without allocating new objects (zero-allocation hot path)
        for (let i = 0; i < this.nodes.length; i++) {
            this.scoreBuffer[i].index = i;
            this.scoreBuffer[i].score = (this.nodes[i] as Utility).getScore(ctx);
        }

        // Sort descending by score, deterministic tie-break ascending by original index
        this.scoreBuffer.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.index - b.index;
        });

        let finalResult: NodeResult = NodeResult.Succeeded;
        let newRunningIndex: number | undefined = undefined;

        for (let i = 0; i < this.scoreBuffer.length; i++) {
            const index = this.scoreBuffer[i].index;
            const node = this.nodes[index];
            const result = BTNode.Tick(node, ctx);

            if (result === NodeResult.Failed || result === NodeResult.Running) {
                finalResult = result;
                if (result === NodeResult.Running) {
                    newRunningIndex = index;
                }
                break;
            }
        }

        // Only abort the previously running node if it's no longer the actively running node
        if (this.currentlyRunningIndex !== undefined && this.currentlyRunningIndex !== newRunningIndex) {
            BTNode.Abort(this.nodes[this.currentlyRunningIndex], ctx);
        }

        this.currentlyRunningIndex = newRunningIndex;

        return finalResult;
    }

    protected override onReset(): void {
        this.currentlyRunningIndex = undefined;
    }

    protected override onAbort(ctx: TickContext): void {
        super.onAbort(ctx);
    }
}
