import { Action } from "../../base/action";
import { NodeResult } from "../../base/types";

export class AlwaysFailure extends Action {
    public override readonly defaultName = "AlwaysFailure";

    protected override onTick(): NodeResult {
        return NodeResult.Failed;
    }
}
