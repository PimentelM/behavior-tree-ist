import { Composite } from "../base/composite";
import { ConditionNode } from "../base/condition";
import { BTNode, type TickContext } from "../base/node";
import { NodeResult, NodeFlags } from "../base/types";

class DebugGate extends ConditionNode {
    public override readonly defaultName = "DebugGate";

    constructor() {
        super("DebugGate", (ctx) => ctx.isDebugEnabled);
    }
}

export class DebugNode extends Composite {
    public override readonly defaultName = "Debug";
    private readonly gate: DebugGate;

    constructor(children: BTNode[]) {
        const gate = new DebugGate();
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
