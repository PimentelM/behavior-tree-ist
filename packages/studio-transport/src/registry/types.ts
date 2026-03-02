import { BehaviourTree, SerializableNode } from "@behavior-tree-ist/core";

export interface RegisteredTree {
    treeId: string;
    tree: BehaviourTree;
    streaming: boolean;
    serializedTree: SerializableNode;
    serializedTreeHash: string;
}

export interface TreeRegistryOptions {
    streaming?: boolean;
}
