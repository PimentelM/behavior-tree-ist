import { BTNode } from "../base/node";
import { SerializableNode } from "../base/types";

export function serializeTree(root: BTNode): SerializableNode {
    const serialized: SerializableNode = {
        id: root.id,
        nodeFlags: root.nodeFlags,
        defaultName: root.defaultName,
        displayName: root.displayName,
        name: root.name,
    };

    if (root.tags && root.tags.length > 0) {
        serialized.tags = root.tags;
    }

    serialized.state = root.getDisplayState?.();

    const children = root.getChildren?.();
    if (children && children.length > 0) {
        serialized.children = children.map(child => serializeTree(child));
    }

    return serialized;
}
