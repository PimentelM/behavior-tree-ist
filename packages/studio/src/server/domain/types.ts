import { SerializableNode } from "@behavior-tree-ist/core";

export interface Client {
    clientId: string;
    isOnline: boolean;
    connectedAt: number | undefined;
    disconnectedAt: number | undefined;
}

export interface StoredTree {
    clientId: string;
    treeId: string;
    serializedTree: SerializableNode;
    hash: string;
    registeredAt: number;
}

export interface ServerSettings {
    maxTickRecordsPerTree: number;  // Default: 10000
}
