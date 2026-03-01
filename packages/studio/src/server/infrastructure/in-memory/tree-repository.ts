import { TreeRepository, StoredTree } from "../../domain";
import { SerializableNode } from "@behavior-tree-ist/core";

export class InMemoryTreeRepository implements TreeRepository {
    // map key: `${clientId}:${treeId}`
    private readonly trees = new Map<string, StoredTree>();

    private getKey(clientId: string, treeId: string): string {
        return `${clientId}:${treeId}`;
    }

    upsert(clientId: string, treeId: string, serializedTree: SerializableNode, hash: string): StoredTree {
        const key = this.getKey(clientId, treeId);

        let existing = this.trees.get(key);
        if (!existing) {
            existing = {
                clientId,
                treeId,
                serializedTree,
                hash,
                registeredAt: Date.now()
            };
        } else {
            existing.serializedTree = serializedTree;
            existing.hash = hash;
        }

        this.trees.set(key, existing);
        return existing;
    }

    find(clientId: string, treeId: string): StoredTree | undefined {
        return this.trees.get(this.getKey(clientId, treeId));
    }

    findByClient(clientId: string): StoredTree[] {
        const results: StoredTree[] = [];
        for (const [key, value] of this.trees.entries()) {
            if (key.startsWith(`${clientId}:`)) {
                results.push(value);
            }
        }
        return results;
    }

    delete(clientId: string, treeId: string): void {
        this.trees.delete(this.getKey(clientId, treeId));
    }

    deleteByClient(clientId: string): void {
        const keysToDelete: string[] = [];
        for (const key of this.trees.keys()) {
            if (key.startsWith(`${clientId}:`)) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.trees.delete(key);
        }
    }
}
