import { BTNode } from "../base/node";
import { SerializableNode } from "../base/types";

export function serializeTree(root: BTNode): SerializableNode {
    const serialized: SerializableNode = {
        id: root.id,
        type: root.NODE_TYPE,
        displayName: root.displayName
    };

    serialized.state = root.getDisplayState?.();

    const children = root.getChildren();
    if (children && children.length > 0) {
        serialized.children = children.map(child => serializeTree(child));
    }

    return serialized;
}
