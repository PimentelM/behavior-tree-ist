import { BTNode, type TickContext } from "../../base/node";
import { Decorator } from "../../base/decorator";
import { NodeFlags, type NodeResult, type ActivityMetadata } from "../../base/types";

export type SubTreeMetadata = {
    id?: string;
    namespace?: string;
};

export class SubTree extends Decorator {
    public override readonly defaultName = "SubTree";
    private readonly _subTreeMetadata: Readonly<SubTreeMetadata>;
    private _ownTags: Set<string> = new Set();
    private _ownActivity: ActivityMetadata | undefined;

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

    public override get tags(): readonly string[] {
        return Array.from(this._ownTags);
    }

    public override addTags(tags: string[]): this {
        for (const tag of tags) {
            this._ownTags.add(tag);
        }
        return this;
    }

    public override get activity(): ActivityMetadata | undefined {
        return this._ownActivity;
    }

    public override setActivity(activity: ActivityMetadata | undefined): this {
        if (activity === true) {
            this._ownActivity = true;
            return this;
        }
        const normalized = activity?.trim();
        this._ownActivity = normalized ? normalized : undefined;
        return this;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }
}
