import { BTNode, type TickContext } from "./node";
import { NodeFlags, type NodeResult, type ActivityMetadata } from "./types";

export type SubTreeMetadata = {
    id?: string;
    namespace?: string;
};

export class SubTree extends BTNode {
    public override readonly defaultName = "SubTree";
    private readonly _subTreeMetadata: Readonly<SubTreeMetadata>;
    private _ownTags: Set<string> = new Set();
    private _ownActivity: ActivityMetadata | undefined;

    constructor(public child: BTNode, metadata: SubTreeMetadata = {}) {
        super();
        this.addFlags(NodeFlags.SubTree);
        this.child.attachToParent(this);
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

    public override getChildren(): ReadonlyArray<BTNode> {
        return [this.child];
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

    protected override onAbort(ctx: TickContext): void {
        BTNode.Abort(this.child, ctx);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        return BTNode.Tick(this.child, ctx);
    }
}
