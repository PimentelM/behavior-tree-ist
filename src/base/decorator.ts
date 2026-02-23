import { BTNode, TickContext } from "./node";
import { NodeFlags } from "./types";

export abstract class Decorator extends BTNode {
    public readonly defaultName: string = "Decorator";

    constructor(public child: BTNode) {
        super();
        this.addFlags(NodeFlags.Decorator);
    }

    public override getChildren(): BTNode[] {
        return [this.child];
    }

    protected override onAbort(ctx: TickContext): void {
        BTNode.Abort(this.child, ctx);
    }
}

export function decorate(node: BTNode, ...specs: Parameters<typeof node.decorate>): BTNode {
    return node.decorate(...specs);
}
