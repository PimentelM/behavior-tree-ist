import { type RegisteredTree, type TreeId, type TreeRegistryOptions } from "./types";
import { assertValidTreeId } from "./validation";
import { type OffFunction } from "../types";
import { type BehaviourTree } from "../tree";
import { type TickRecord } from "../base";

export class TreeRegistry {
    private readonly trees = new Map<TreeId, RegisteredTree>();
    private readonly treeTickOffFunctions = new Map<TreeId, OffFunction>();

    public register(treeId: TreeId, tree: BehaviourTree, _options?: TreeRegistryOptions): void {
        assertValidTreeId(treeId);

        if (this.trees.has(treeId)) {
            throw new Error(`Tree with id "${treeId}" is already registered`);
        }

        const serializedTree = tree.toJSON();

        const entry: RegisteredTree = {
            treeId,
            tree,
            serializedTree,
        };

        this.trees.set(treeId, entry);

        // Subscribe to tick records
        const off = tree.onTickRecord((record) => { this.emitTreeTick(treeId, record); });
        this.treeTickOffFunctions.set(treeId, off);

        this.emitTreeRegistered(entry);
    }

    public remove(treeId: TreeId): void {
        if (!this.trees.has(treeId)) {
            throw new Error(`Tree with id "${treeId}" is not registered`);
        }

        // Unsubscribe from tick records
        this.treeTickOffFunctions.get(treeId)?.();
        this.treeTickOffFunctions.delete(treeId);

        this.trees.delete(treeId);

        this.emitTreeRemoved(treeId);
    }

    public get(treeId: string): RegisteredTree | undefined {
        return this.trees.get(treeId);
    }

    public getAll(): ReadonlyMap<string, RegisteredTree> {
        return this.trees;
    }


    // Events

    private readonly treeRegisteredListeners = new Set<(entry: RegisteredTree) => void>();
    private emitTreeRegistered(entry: RegisteredTree): void {
        for (const listener of this.treeRegisteredListeners) {
            listener(entry);
        }
    }
    public onTreeRegistered(handler: (entry: RegisteredTree) => void): OffFunction {
        this.treeRegisteredListeners.add(handler);
        return () => this.treeRegisteredListeners.delete(handler);
    }

    private readonly treeRemovedListeners = new Set<(treeId: TreeId) => void>();
    private emitTreeRemoved(treeId: string): void {
        for (const listener of this.treeRemovedListeners) {
            listener(treeId);
        }
    }
    public onTreeRemoved(handler: (treeId: string) => void): OffFunction {
        this.treeRemovedListeners.add(handler);
        return () => this.treeRemovedListeners.delete(handler);
    }

    private readonly tickListeners = new Set<(treeId: TreeId, record: TickRecord) => void>();
    private emitTreeTick(treeId: string, record: TickRecord): void {
        for (const listener of this.tickListeners) {
            listener(treeId, record);
        }
    }
    public onTreeTick(handler: (treeId: string, record: TickRecord) => void): OffFunction {
        this.tickListeners.add(handler);
        return () => this.tickListeners.delete(handler);
    }
}
