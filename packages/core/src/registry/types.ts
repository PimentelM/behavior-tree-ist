import { type SerializableNode } from "../base";
import { type BehaviourTree } from "../tree";

export type TreeId = string;

export interface RegisteredTree {
    treeId: TreeId;
    tree: BehaviourTree;
    serializedTree: SerializableNode;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TreeRegistryOptions {
}
