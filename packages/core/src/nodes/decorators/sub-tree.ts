import { AnyDecoratorSpec, BTNode, TickContext, ValidateDecoratorSpecs } from "../../base/node";
import { decorate, Decorator } from "../../base/decorator";
import { NodeFlags, NodeResult, SerializableState } from "../../base/types";

export type SubTreeMetadata = {
    id?: string;
    namespace?: string;
};

export class SubTree extends Decorator {
    public override readonly defaultName = "SubTree";

    constructor(child: BTNode, public readonly metadata: SubTreeMetadata = {}) {
        super(child);
        this.addFlags(NodeFlags.SubTree);
    }

    public override getDisplayState(): SerializableState | undefined {
        if (this.metadata.id === undefined && this.metadata.namespace === undefined) {
            return undefined;
        }

        return {
            id: this.metadata.id,
            namespace: this.metadata.namespace,
        };
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }

    // Forward decorations to the child
    public override decorate<const Specs extends readonly AnyDecoratorSpec[]>(...specs: Specs & ValidateDecoratorSpecs<Specs>): BTNode {
        this.child.detachFromParent();
        const decoratedChild = this.child.decorate(...specs);
        this.child = decoratedChild;
        this.child.attachToParent(this);
        return this;
    }
}
