import { BTNode, TickContext, TickTraceEvent, SerializableNode, TickRecord } from "./base";
import { NodeFlags, hasFlag } from "./base/types";
import { serializeTree } from "./serialization/serializer";

type PublicTickContext = {
    now?: number;
}

export class BehaviourTree {
    private currentTickId: number = 1;
    private root: BTNode;
    private traceEnabled: boolean = false;
    private profilingTimeProvider: (() => number) | undefined;

    constructor(root: BTNode) {
        this.root = root;
    }

    public enableTrace(): BehaviourTree {
        this.traceEnabled = true;
        return this;
    }

    public disableTrace(): BehaviourTree {
        this.traceEnabled = false;
        this.profilingTimeProvider = undefined;
        return this;
    }

    public enableProfiling(getTime: () => number): BehaviourTree {
        this.profilingTimeProvider = getTime;
        this.traceEnabled = true;
        return this;
    }

    public disableProfiling(): BehaviourTree {
        this.profilingTimeProvider = undefined;
        return this;
    }

    public serialize(): SerializableNode {
        return serializeTree(this.root);
    }

    public tick(pCtx: PublicTickContext = {}): TickRecord {
        const events: TickTraceEvent[] = [];
        const now = pCtx.now ?? Date.now();
        const tickId = this.currentTickId;
        const ctx: TickContext = {
            tickId,
            now,
            events,
            trace: (node, result, startedAt, finishedAt) => {
                if (!this.traceEnabled) return;
                const event: TickTraceEvent = {
                    tickId: ctx.tickId,
                    timestamp: ctx.now,
                    nodeId: node.id,
                    result
                };

                if (hasFlag(node.nodeFlags, NodeFlags.Stateful) && node.getDisplayState) {
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

        BTNode.Tick(this.root, ctx);

        this.currentTickId++;
        return { tickId, timestamp: now, events };
    }

}