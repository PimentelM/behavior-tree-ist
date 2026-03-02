import { BehaviourTree, TickRecord } from "@behavior-tree-ist/core";
import { assertValidTreeId } from "../protocol/validation";
import { RegisteredTree, TreeRegistryOptions } from "./types";
import { Unsubscribe } from "../transport/types";

export class TreeRegistry {
    private readonly trees = new Map<string, RegisteredTree>();

    private readonly treeRegisteredListeners = new Set<(entry: RegisteredTree) => void>();
    private readonly treeRemovedListeners = new Set<(treeId: string) => void>();
    private readonly tickListeners = new Set<(treeId: string, record: TickRecord) => void>();

    public register(treeId: string, tree: BehaviourTree, options?: TreeRegistryOptions): void {
        assertValidTreeId(treeId);

        if (this.trees.has(treeId)) {
            throw new Error(`Tree with id "${treeId}" is already registered`);
        }

        tree.useNowAsTickId();

        const serializedTree = tree.toJSON();

        const entry: RegisteredTree = {
            treeId,
            tree,
            streaming: options?.streaming ?? false,
            serializedTree,
        };

        this.trees.set(treeId, entry);

        for (const listener of this.treeRegisteredListeners) {
            listener(entry);
        }
    }

    public remove(treeId: string): void {
        if (!this.trees.has(treeId)) {
            throw new Error(`Tree with id "${treeId}" is not registered`);
        }

        this.trees.delete(treeId);

        for (const listener of this.treeRemovedListeners) {
            listener(treeId);
        }
    }

    public get(treeId: string): RegisteredTree | undefined {
        return this.trees.get(treeId);
    }

    public getAll(): ReadonlyMap<string, RegisteredTree> {
        return this.trees;
    }

    public enableStreaming(treeId: string): void {
        const entry = this.trees.get(treeId);
        if (entry) {
            entry.streaming = true;
        }
    }

    public disableStreaming(treeId: string): void {
        const entry = this.trees.get(treeId);
        if (entry) {
            entry.streaming = false;
        }
    }

    public isStreaming(treeId: string): boolean {
        return this.trees.get(treeId)?.streaming ?? false;
    }

    public reportTick(treeId: string, record: TickRecord): void {
        if (!this.trees.has(treeId)) return;

        for (const listener of this.tickListeners) {
            listener(treeId, record);
        }
    }

    public onTreeRegistered(handler: (entry: RegisteredTree) => void): Unsubscribe {
        this.treeRegisteredListeners.add(handler);
        return () => this.treeRegisteredListeners.delete(handler);
    }

    public onTreeRemoved(handler: (treeId: string) => void): Unsubscribe {
        this.treeRemovedListeners.add(handler);
        return () => this.treeRemovedListeners.delete(handler);
    }

    public onTick(handler: (treeId: string, record: TickRecord) => void): Unsubscribe {
        this.tickListeners.add(handler);
        return () => this.tickListeners.delete(handler);
    }
}
