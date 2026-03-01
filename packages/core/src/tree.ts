import { BTNode, TickContext, TickTraceEvent, SerializableNode, TickRecord, TickRuntime } from "./base";
import { RefChangeEvent } from "./base/types";
import { serializeTree } from "./serialization/serializer";

type PublicTickContext = {
    now?: number;
}

export class BehaviourTree {
    private static NEXT_TREE_ID = 1;

    public readonly treeId: number = BehaviourTree.NEXT_TREE_ID++;
    private currentTickId: number = 1;
    private root: BTNode;
    private stateTraceEnabled: boolean = false;
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

    public enableStateTrace(): BehaviourTree {
        this.stateTraceEnabled = true;
        return this;
    }

    public disableStateTrace(): BehaviourTree {
        this.stateTraceEnabled = false;
        return this;
    }

    public enableProfiling(getTime: () => number): BehaviourTree {
        this.profilingTimeProvider = getTime;
        return this;
    }

    public disableProfiling(): BehaviourTree {
        this.profilingTimeProvider = undefined;
        return this;
    }

    public serialize(options?: { includeState?: boolean }): SerializableNode {
        return serializeTree(this.root, options);
    }

    public toJSON(): SerializableNode {
        return this.serialize({ includeState: true });
    }

    public tick(pCtx: PublicTickContext = {}): TickRecord {
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
                    tickId: ctx.tickId,
                    timestamp: ctx.now,
                    nodeId: node.id,
                    result
                };

                if (this.stateTraceEnabled && node.getDisplayState) {
                    const state = node.getDisplayState();
                    if (state) {
                        event.state = state;
                    }
                }

                if (startedAt !== undefined && finishedAt !== undefined) {
                    event.startedAt = startedAt;
                    event.finishedAt = finishedAt;
                }

                events.push(event);
            },
            getTime: this.profilingTimeProvider,
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
        } finally {
            this.runtime.isTickRunning = false;
        }

        this.currentTickId++;
        return { tickId, timestamp: now, events, refEvents };
    }

}
