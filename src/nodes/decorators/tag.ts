import { BTNode } from "../../base/node";

export class Tag {
    constructor(child: BTNode, ...tags: string[]) {
        child.addTags(tags);
        return child as any;
    }
}
