import { BTNode } from "./node";
import { NodeType } from "./types";

export class Decorator extends BTNode {
    public readonly NODE_TYPE: NodeType = "Decorator";

    constructor(public child: BTNode) {
        super();
    }
}

export function decorate(node: BTNode, ...specs: Parameters<typeof node.decorate>): BTNode {
    return node.decorate(...specs);
}