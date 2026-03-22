import { BTNode, type TickContext, type TickTraceEvent, type SerializableNode, type TickRecord, type TickRuntime } from "./base";
import { type RefChangeEvent } from "./base/types";
import { serializeTree } from "./serialization/serializer";
import { type OffFunction } from "./types";

type PublicTickContext = {
    now?: number;
}

export class BehaviourTree {
    private static NEXT_TREE_ID = 1;

    public readonly treeId: number = BehaviourTree.NEXT_TREE_ID++;
    private currentTickId: number = 1;
    private readonly root: BTNode;
    private stateTraceEnabled: boolean = false;
    private profilingEnabled: boolean = false;
    private profilingTimeProvider: (() => number) | undefined;

    private runtime: TickRuntime = {
        treeId: this.treeId,
        latest: null,
        isTickRunning: false,
        pendingRefEvents: []
    };

    constructor(root: BTNode) {
        this.root = root;
    }

    public get isStateTraceEnabled(): boolean {
        return this.stateTraceEnabled;
    }

    public get isProfilingEnabled(): boolean {
        return this.profilingEnabled;
    }

    public enableStateTrace(): this {
        this.stateTraceEnabled = true;
        return this;
    }

    public disableStateTrace(): this {
        this.stateTraceEnabled = false;
        return this;
    }

    public enableProfiling(): this {
        this.profilingEnabled = true;
        return this;
    }

    public disableProfiling(): this {
        this.profilingEnabled = false;
        return this;
    }

    public setProfilingTimeProvider(provider: () => number): this {
        this.profilingTimeProvider = provider;
        return this;
    }

    public validate(): string[] {
        const errors: string[] = [];
        const queue: BTNode[] = [this.root];
        while (queue.length > 0) {
            const node = queue.shift() as BTNode;
            if (node.validate) {
                errors.push(...node.validate());
            }
            const children = node.getChildren?.();
            if (children) {
                queue.push(...children);
            }
        }
        return errors;
    }

    public serialize(options?: { includeState?: boolean }): SerializableNode {
        return serializeTree(this.root, options);
    }

    public toJSON(): SerializableNode {
        return this.serialize({ includeState: true });
    }

    public tick(pCtx: PublicTickContext = {}): TickRecord {
        if (this.runtime.isTickRunning) {
            throw new Error('Re-entrant tick detected: BehaviourTree.tick() called while a tick is already in progress');
        }

        const events: TickTraceEvent[] = [];
        const refEvents: RefChangeEvent[] = [];
        const now = pCtx.now ?? Date.now();
        const tickId = this.currentTickId;

        const ctx: TickContext = {
            tickId,
            now,
            events,
            refEvents,
            isStateTraceEnabled: this.stateTraceEnabled,
            runtime: this.runtime,
            trace: (node, result, startedAt, finishedAt) => {
                const event: TickTraceEvent = {
                    nodeId: node.id,
                    result
                };

                if (this.stateTraceEnabled && node.getDisplayState) {
                    const state = node.getDisplayState();
                    if (state !== undefined) {
                        event.state = state;
                    }
                }

                if (startedAt !== undefined && finishedAt !== undefined) {
                    event.startedAt = startedAt;
                    event.finishedAt = finishedAt;
                }

                events.push(event);
            },
            getTime: this.profilingEnabled ? this.profilingTimeProvider : undefined,
        }

        // Pick up pending ref events from between ticks
        if (this.runtime.pendingRefEvents.length > 0 && this.stateTraceEnabled) {
            for (const refEvent of this.runtime.pendingRefEvents) {
                refEvent.tickId = tickId; // Attribute to this tick
                refEvent.isAsync = true;
                refEvent.timestamp = now;
                refEvent.nodeId = refEvent.nodeId ?? this.root.id;
                refEvents.push(refEvent);
            }
            this.runtime.pendingRefEvents = [];
        } else if (this.runtime.pendingRefEvents.length > 0) {
            // State tracing is disabled; drop deferred ref events.
            this.runtime.pendingRefEvents = [];
        }

        this.runtime.latest = ctx;
        this.runtime.isTickRunning = true;
        try {
            BTNode.Tick(this.root, ctx);
            this.currentTickId++;
            const tickRecord = { tickId, timestamp: now, events, refEvents };
            this.emitTickRecord(tickRecord);
            return tickRecord;
        } finally {
            this.runtime.isTickRunning = false;
        }
    }


    // Events
    private tickRecordListeners = new Set<(record: TickRecord) => void>();
    private emitTickRecord(record: TickRecord): void {
        for (const listener of this.tickRecordListeners) {
            listener(record);
        }
    }
    public onTickRecord(handler: (record: TickRecord) => void): OffFunction {
        this.tickRecordListeners.add(handler);
        return () => this.tickRecordListeners.delete(handler);
    }
}
