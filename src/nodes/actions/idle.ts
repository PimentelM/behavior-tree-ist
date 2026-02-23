import { Action } from "../../base/action";
import { NodeResult } from "../../base/types";

export class IdleAction extends Action {
    public override readonly defaultName = "IdleAction";

    protected override onTick(): NodeResult {
        return NodeResult.Running;
    }
}