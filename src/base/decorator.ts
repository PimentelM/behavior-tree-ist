import { BTNode, TickContext } from "./node";
import { NodeType } from "./types";

export abstract class Decorator extends BTNode {
    public readonly NODE_TYPE: NodeType = "Decorator";

    constructor(public child: BTNode) {
        super();
    }

    protected override onAbort(ctx: TickContext): void {
        BTNode.Abort(this.child, ctx);
    }
}

export function decorate(node: BTNode, ...specs: Parameters<typeof node.decorate>): BTNode {
    return node.decorate(...specs);
}
