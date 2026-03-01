import { BehaviourTree } from "../tree";
import type { OffFunction, TickRecord, SerializableNode } from "../base/types";
import type { AgentSetCaptureScope, AgentTreeInfo } from "./protocol";

export interface RegisterTreeOptions {
    name: string;
    description?: string;
    treeKey?: string;
    profilingClock?: () => number;
}

export type RegisteredTreeRecord = AgentTreeInfo & {
    tree: BehaviourTree;
};

type CaptureBaseline = {
    stateTraceEnabled: boolean;
    profilingEnabled: boolean;
    profilingClock?: () => number;
};

type RegisteredTreeEntry = {
    treeKey: string;
    name: string;
    description?: string;
    tree: BehaviourTree;
    offTickRecord: OffFunction;
    baseline: CaptureBaseline;
    preferredProfilingClock?: () => number;
};

function defaultProfilingClock(): number {
    const perf = (globalThis as unknown as { performance?: { now: () => number } }).performance;
    if (perf && typeof perf.now === "function") {
        return perf.now();
    }
    return Date.now();
}

export class BehaviourTreeRegistry {
    private readonly byTreeKey = new Map<string, RegisteredTreeEntry>();
    private readonly byTreeId = new Map<number, string>();
    private readonly tickListeners = new Set<(treeKey: string, record: TickRecord) => void>();
    private readonly treesChangedListeners = new Set<() => void>();

    public registerTree(tree: BehaviourTree, options: RegisterTreeOptions): { treeKey: string; off: OffFunction } {
        if (!options.name || options.name.trim().length === 0) {
            throw new Error("registerTree requires a non-empty name");
        }

        const treeKey = this.createTreeKey(tree, options.treeKey);
        const baseline: CaptureBaseline = {
            stateTraceEnabled: tree.isStateTraceEnabled(),
            profilingEnabled: tree.isProfilingEnabled(),
            profilingClock: options.profilingClock,
        };

        const offTickRecord = tree.onTickRecord((record) => {
            for (const listener of this.tickListeners) {
                listener(treeKey, record);
            }
        });

        const entry: RegisteredTreeEntry = {
            treeKey,
            name: options.name,
            description: options.description,
            tree,
            offTickRecord,
            baseline,
            preferredProfilingClock: options.profilingClock,
        };

        this.byTreeKey.set(treeKey, entry);
        this.byTreeId.set(tree.treeId, treeKey);
        this.emitTreesChanged();

        const off = () => {
            this.unregisterTree(treeKey);
        };

        return { treeKey, off };
    }

    public unregisterTree(treeKey: string): void {
        const entry = this.byTreeKey.get(treeKey);
        if (!entry) {
            return;
        }

        entry.offTickRecord();
        this.byTreeKey.delete(treeKey);
        this.byTreeId.delete(entry.tree.treeId);
        this.emitTreesChanged();
    }

    public listTrees(): AgentTreeInfo[] {
        return [...this.byTreeKey.values()].map((entry) => ({
            treeKey: entry.treeKey,
            treeId: entry.tree.treeId,
            name: entry.name,
            description: entry.description,
        }));
    }

    public getTreeSnapshot(treeKey: string): SerializableNode | undefined {
        const entry = this.byTreeKey.get(treeKey);
        if (!entry) {
            return undefined;
        }
        return entry.tree.serialize();
    }

    public setCapture(input: {
        scope: AgentSetCaptureScope;
        treeKey?: string;
        traceState?: boolean;
        profiling?: boolean;
    }): void {
        const entries = this.resolveScope(input.scope, input.treeKey);
        for (const entry of entries) {
            if (typeof input.traceState === "boolean") {
                if (input.traceState) {
                    entry.tree.enableStateTrace();
                } else {
                    entry.tree.disableStateTrace();
                }
            }

            if (typeof input.profiling === "boolean") {
                if (input.profiling) {
                    const clock = entry.preferredProfilingClock ?? entry.baseline.profilingClock ?? defaultProfilingClock;
                    entry.tree.enableProfiling(clock);
                } else {
                    entry.tree.disableProfiling();
                }
            }
        }
    }

    public restoreBaseline(input: { scope: AgentSetCaptureScope; treeKey?: string }): void {
        const entries = this.resolveScope(input.scope, input.treeKey);
        for (const entry of entries) {
            if (entry.baseline.stateTraceEnabled) {
                entry.tree.enableStateTrace();
            } else {
                entry.tree.disableStateTrace();
            }

            if (entry.baseline.profilingEnabled) {
                const clock = entry.baseline.profilingClock ?? entry.preferredProfilingClock ?? defaultProfilingClock;
                entry.tree.enableProfiling(clock);
            } else {
                entry.tree.disableProfiling();
            }
        }
    }

    public onTick(handler: (treeKey: string, record: TickRecord) => void): OffFunction {
        this.tickListeners.add(handler);
        return () => {
            this.tickListeners.delete(handler);
        };
    }

    public onTreesChanged(handler: () => void): OffFunction {
        this.treesChangedListeners.add(handler);
        return () => {
            this.treesChangedListeners.delete(handler);
        };
    }

    public getTreeByKey(treeKey: string): RegisteredTreeRecord | undefined {
        const entry = this.byTreeKey.get(treeKey);
        if (!entry) {
            return undefined;
        }

        return {
            treeKey: entry.treeKey,
            treeId: entry.tree.treeId,
            name: entry.name,
            description: entry.description,
            tree: entry.tree,
        };
    }

    private createTreeKey(tree: BehaviourTree, requested?: string): string {
        if (requested && requested.trim().length > 0) {
            if (this.byTreeKey.has(requested)) {
                throw new Error(`Tree key "${requested}" is already registered`);
            }
            return requested;
        }

        const base = `tree-${tree.treeId}`;
        if (!this.byTreeKey.has(base)) {
            return base;
        }

        let suffix = 2;
        let candidate = `${base}-${suffix}`;
        while (this.byTreeKey.has(candidate)) {
            suffix++;
            candidate = `${base}-${suffix}`;
        }
        return candidate;
    }

    private resolveScope(scope: AgentSetCaptureScope, treeKey?: string): RegisteredTreeEntry[] {
        if (scope === "all") {
            return [...this.byTreeKey.values()];
        }

        if (!treeKey) {
            throw new Error("tree scope requires a treeKey");
        }

        const entry = this.byTreeKey.get(treeKey);
        if (!entry) {
            throw new Error(`Unknown tree key "${treeKey}"`);
        }
        return [entry];
    }

    private emitTreesChanged(): void {
        for (const listener of this.treesChangedListeners) {
            listener();
        }
    }
}
