import { Action } from "../../base/action";
import { NodeResult } from "../../base/types";

export class AlwaysSuccess extends Action {
    public override readonly defaultName = "AlwaysSuccess";

    protected override onTick(): NodeResult {
        return NodeResult.Succeeded;
    }
}
