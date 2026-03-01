import { AnyDecoratorSpec, BTNode, TickContext, ValidateDecoratorSpecs } from "../../base/node";
import { Decorator } from "../../base/decorator";
import { NodeFlags, NodeResult } from "../../base/types";

export type SubTreeMetadata = {
    id?: string;
    namespace?: string;
};

export class SubTree extends Decorator {
    public override readonly defaultName = "SubTree";
    private readonly _subTreeMetadata: Readonly<SubTreeMetadata>;

    constructor(child: BTNode, metadata: SubTreeMetadata = {}) {
        super(child);
        this.addFlags(NodeFlags.SubTree);
        this._subTreeMetadata = Object.freeze({
            id: metadata.id,
            namespace: metadata.namespace,
        });
        if (this._subTreeMetadata.id !== undefined || this._subTreeMetadata.namespace !== undefined) {
            this.setMetadata(this._subTreeMetadata);
        }
    }

    public get subTreeMetadata(): Readonly<SubTreeMetadata> {
        return this._subTreeMetadata;
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
