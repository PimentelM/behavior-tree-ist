import { BTNode, TickContext, TickTraceEvent } from "./base";

type PublicTickContext = {
    tickNumber?: number;
    now?: number;
}

export class BehaviourTree {
    private currentTickId: number = 1;
    private root: BTNode;
    private traceEnabled: boolean = false;

    constructor(root: BTNode) {
        this.root = root;
    }

    public enableTrace(): BehaviourTree {
        this.traceEnabled = true;
        return this;
    }

    public disableTrace(): BehaviourTree {
        this.traceEnabled = false;
        return this;
    }

    public tick(pCtx: PublicTickContext = {}): TickTraceEvent[] {

        const events: TickTraceEvent[] = [];
        const ctx: TickContext = {
            tickId: this.currentTickId,
            tickNumber: pCtx.tickNumber ?? this.currentTickId,
            now: pCtx.now ?? Date.now(),
            events,
            trace: (node, result) => {
                if (!this.traceEnabled) return;
                events.push({
                    tickId: ctx.tickId,
                    tickNumber: ctx.tickNumber,
                    timestampMs: ctx.now,
                    nodeId: node.id,
                    nodeType: node.NODE_TYPE,
                    nodeName: node.name,
                    nodeDisplayName: node.displayName,
                    result
                });
            },
        }

        BTNode.Tick(this.root, ctx);

        this.currentTickId++;
        return events;
    }

}