import { Action } from "./base/action";
import { BTNode, TickContext } from "./base/node";
import { NodeResult } from "./base/types";

export function createTickContext(overrides: Partial<TickContext> = {}): TickContext {
    return {
        tickId: 1,
        tickNumber: 1,
        now: 0,
        events: [],
        trace: () => { },
        ...overrides,
    };
}

export function tickNode(node: BTNode, ctxOverrides: Partial<TickContext> = {}): NodeResult {
    return BTNode.Tick(node, createTickContext(ctxOverrides));
}

export function createTracingTickContext(overrides: Partial<TickContext> = {}): TickContext {
    const events = overrides.events ?? [];
    return {
        tickId: 1,
        tickNumber: 1,
        now: 0,
        ...overrides,
        events,
        trace: (node: BTNode, result: NodeResult) => {
            events.push({
                tickId: overrides.tickId ?? 1,
                tickNumber: overrides.tickNumber ?? 1,
                timestampMs: overrides.now ?? 0,
                nodeId: node.id,
                nodeType: node.NODE_TYPE,
                nodeName: node.name,
                nodeDisplayName: node.displayName,
                result,
            });
        },
    };
}

export class StubAction extends Action {
    public override name = "StubAction";
    public abortCount = 0;
    public tickCount = 0;
    private resultQueue: NodeResult[];
    private defaultResult: NodeResult;

    constructor(resultOrQueue: NodeResult | NodeResult[] = NodeResult.Succeeded) {
        super();
        if (Array.isArray(resultOrQueue)) {
            this.resultQueue = [...resultOrQueue];
            this.defaultResult = resultOrQueue[resultOrQueue.length - 1];
        } else {
            this.resultQueue = [];
            this.defaultResult = resultOrQueue;
        }
    }

    public set nextResult(result: NodeResult) {
        this.resultQueue = [result];
    }

    protected override onTick(): NodeResult {
        this.tickCount++;
        if (this.resultQueue.length > 0) {
            return this.resultQueue.shift()!;
        }
        return this.defaultResult;
    }

    protected override onAbort(): void {
        this.abortCount++;
    }
}
