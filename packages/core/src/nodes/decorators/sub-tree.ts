import { BTNode, TickContext } from "../../base/node";
import { Decorator } from "../../base/decorator";
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
}
