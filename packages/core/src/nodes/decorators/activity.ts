import { BTNode } from "../../base/node";
import { ActivityMetadata } from "../../base/types";

export class Activity {
    constructor(child: BTNode, activity: ActivityMetadata) {
        child.setActivity(activity);
        return child as unknown as this;
    }
}
