import { BTNode } from "../../base/node";

export class Activity {
    constructor(child: BTNode, activity: string) {
        child.setActivity(activity);
        return child as unknown as this;
    }
}
