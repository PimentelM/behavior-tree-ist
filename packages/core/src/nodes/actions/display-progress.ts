import { Action } from "../../base/action";
import { NodeResult, NodeFlags, type SerializableState } from "../../base/types";

export interface DisplayProgressValue {
    progress: number;
    label?: string;
}

export class DisplayProgress extends Action {
    public readonly defaultName: string = "DisplayProgress";

    constructor(name: string, private readonly progressFn: () => DisplayProgressValue) {
        super(name);
        this.addFlags(NodeFlags.Display);
    }

    protected override onTick(): NodeResult {
        return NodeResult.Succeeded;
    }

    public override getDisplayState(): SerializableState | undefined {
        const { progress, label } = this.progressFn();
        return label !== undefined ? { progress, label } : { progress };
    }
}
