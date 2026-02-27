import { Action } from "../../base/action";
import { TickContext } from "../../base/node";
import { NodeResult, NodeFlags, SerializableState } from "../../base/types";

export class DisplayState extends Action {
    public readonly defaultName: string = "DisplayState";

    constructor(name: string, private readonly displayFn: () => SerializableState) {
        super(name);
        this.addFlags(NodeFlags.Display);
    }

    protected override onTick(): NodeResult {
        return NodeResult.Succeeded;
    }

    public override getDisplayState(): SerializableState | undefined {
        return this.displayFn();
    }
}
