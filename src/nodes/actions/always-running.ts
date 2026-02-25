import { Action } from "../../base/action";
import { NodeResult } from "../../base/types";

export class AlwaysRunning extends Action {
    public override readonly defaultName = "AlwaysRunning";

    protected override onTick(): NodeResult {
        return NodeResult.Running;
    }
}
