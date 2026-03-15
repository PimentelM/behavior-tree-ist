import { Action } from "../../base/action";
import { NodeResult, NodeFlags, type SerializableState } from "../../base/types";

export class DisplayNote extends Action {
    public readonly defaultName: string = "DisplayNote";

    constructor(name: string, private readonly text: string) {
        super(name);
        this.addFlags(NodeFlags.Display);
    }

    protected override onTick(): NodeResult {
        return NodeResult.Succeeded;
    }

    public override getDisplayState(): SerializableState | undefined {
        return { note: this.text };
    }
}
