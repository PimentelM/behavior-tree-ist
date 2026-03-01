import { BTNode, TickContext } from "./node";
import { NodeFlags } from "./types";

export abstract class Decorator extends BTNode {
    public readonly defaultName: string = "Decorator";

    constructor(public child: BTNode) {
        super();
        this.addFlags(NodeFlags.Decorator);
        this.child.attachToParent(this);
    }

    public override getChildren(): ReadonlyArray<BTNode> {
        return [this.child];
    }

    public override get tags(): readonly string[] {
        return [];
    }

    public override addTags(tags: string[]): this {
        this.child.addTags(tags);
        return this;
    }

    public override get activity(): string | undefined {
        return undefined;
    }

    public override setActivity(activity: string | undefined): this {
        this.child.setActivity(activity);
        return this;
    }

    protected override onAbort(ctx: TickContext): void {
        BTNode.Abort(this.child, ctx);
    }
}

export function decorate(node: BTNode, ...specs: Parameters<typeof node.decorate>): BTNode {
    return node.decorate(...specs);
}
