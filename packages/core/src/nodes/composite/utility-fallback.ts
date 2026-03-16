import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, type TickContext } from "../../base/node";
import { Utility } from "../decorators/utility";

export type UtilitySelectorState = UtilityFallbackState;

export type UtilityFallbackState = number[];


export class UtilityFallback extends Composite {
    public override readonly defaultName = "UtilityFallback";
    private currentlyRunningIndex: number | undefined = undefined;
    private scoreBuffer: { index: number; score: number }[] = [];
    private lastScores: number[] = [];

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Selector, NodeFlags.Utility, NodeFlags.Stateful);
    }

    public static from(nodes: Utility[]): UtilityFallback
    public static from(name: string, nodes: Utility[]): UtilityFallback
    public static from(nameOrNodes: string | Utility[], possiblyNodes?: Utility[]): UtilityFallback {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "UtilityFallback";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : (possiblyNodes as Utility[]);
        const composite = new UtilityFallback(name);
        composite.setNodes(nodes);
        return composite;
    }


    public override addNode(node: Utility): this {
        if (!(node instanceof Utility)) {
            throw new Error(`UtilityFallback ${this.name} only accepts Utility nodes as children.`);
        }
        super.addNode(node);
        this.scoreBuffer.push({ index: this.nodes.length - 1, score: 0 });
        return this;
    }

    public override setNodes(nodes: Utility[]): this {
        for (const node of nodes) {
            if (!(node instanceof Utility)) {
                throw new Error(`UtilityFallback ${this.name} only accepts Utility nodes as children.`);
            }
        }
        super.setNodes(nodes);
        this.scoreBuffer = nodes.map((_, i) => ({ index: i, score: 0 }));
        this.lastScores = [];
        return this;
    }

    public override clearNodes(): this {
        super.clearNodes();
        this.scoreBuffer = [];
        this.lastScores = [];
        return this;
    }

    public override validate(): string[] {
        const errors = super.validate();
        for (const [i, node] of this.nodes.entries()) {
            if (!(node instanceof Utility)) {
                errors.push(`${this.displayName} child at index ${i} is not a Utility node`);
            }
        }
        return errors;
    }

    public override getDisplayState(): UtilityFallbackState {
        return this.lastScores;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`UtilityFallback node ${this.displayName} has no nodes`);
        }

        // Evaluate scores every tick without allocating new objects (zero-allocation hot path)
        for (const [i, entry] of this.scoreBuffer.entries()) {
            entry.index = i;
            entry.score = (this.nodes[i] as Utility).getScore(ctx);
        }

        this.lastScores = this.scoreBuffer.map(({ score }) => score);

        // Sort descending by score, deterministic tie-break ascending by original index
        this.scoreBuffer.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return a.index - b.index;
        });

        let finalResult: NodeResult = NodeResult.Failed;
        let runningOrSucceededIndex: number | undefined = undefined;

        for (const entry of this.scoreBuffer) {
            const index = entry.index;
            const node = this.nodes[index] as BTNode;
            const result = BTNode.Tick(node, ctx);

            if (result === NodeResult.Succeeded || result === NodeResult.Running) {
                finalResult = result;
                runningOrSucceededIndex = index;
                break;
            }
        }

        // Abort any node that was previously running but isn't the one we just ticked and returned running/succeeded.
        // Also abort it if we completely failed out.
        if (this.currentlyRunningIndex !== undefined && this.currentlyRunningIndex !== runningOrSucceededIndex) {
            BTNode.Abort(this.nodes[this.currentlyRunningIndex] as BTNode, ctx);
        }

        if (finalResult === NodeResult.Running) {
            this.currentlyRunningIndex = runningOrSucceededIndex;
        } else {
            this.currentlyRunningIndex = undefined;
        }

        return finalResult;
    }

    protected override onReset(): void {
        this.currentlyRunningIndex = undefined;
    }

    protected override onAbort(ctx: TickContext): void {
        super.onAbort(ctx);
    }
}

export const UtilitySelector = UtilityFallback;
