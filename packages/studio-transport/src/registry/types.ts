import { BehaviourTree, SerializableNode } from "@behavior-tree-ist/core";

export interface RegisteredTree {
    treeId: string;
    tree: BehaviourTree;
    streaming: boolean;
    serializedTree: SerializableNode;
}

export interface TreeRegistryOptions {
    streaming?: boolean;
}
