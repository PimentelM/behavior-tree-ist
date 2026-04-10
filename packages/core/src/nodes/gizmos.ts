import { Composite } from "../base/composite";
import { ConditionNode } from "../base/condition";
import { BTNode, type TickContext } from "../base/node";
import { NodeResult, NodeFlags } from "../base/types";

class GizmosGate extends ConditionNode {
    public override readonly defaultName = "GizmosGate";

    constructor() {
        super("GizmosGate", (ctx) => ctx.isDebugEnabled);
    }
}

export class Gizmos extends Composite {
    public override readonly defaultName = "Gizmos";
    private readonly gate: GizmosGate;

    constructor(children: BTNode[]) {
        const gate = new GizmosGate();
        super();
        this.gate = gate;
        this.addFlags(NodeFlags.Debug);
        this.setNodes([gate, ...children]);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        const gateResult = BTNode.Tick(this.gate, ctx);
        if (gateResult !== NodeResult.Succeeded) {
            return NodeResult.Skipped;
        }

        for (let i = 1; i < this.nodes.length; i++) {
            const result = BTNode.Tick(this.nodes[i]!, ctx);
            if (result === NodeResult.Running) {
                BTNode.Abort(this.nodes[i]!, ctx);
            }
        }

        return NodeResult.Skipped;
    }

    protected override onAbort(ctx: TickContext): void {
        this.abortAllChildren(ctx);
    }
}
