import { Action } from "./base/action";
import { BTNode, TickContext } from "./base/node";
import { NodeResult } from "./base/types";

export function createTickContext(overrides: Partial<TickContext> = {}): TickContext {
    const mockTickId = overrides.tickId ?? 1;
    return {
        tickId: mockTickId,
        now: 0,
        events: [],
        refEvents: [],
        isTracingEnabled: true,
        trace: () => { },
        ...overrides,
    };
}

export type NodeTicker = {
    tick: (node: BTNode, overrides?: Partial<TickContext>) => NodeResult;
    abort: (node: BTNode, overrides?: Partial<TickContext>) => void;
};

export function createNodeTicker(startTickId: number = 1): NodeTicker {
    let nextTickId = startTickId;

    return {
        tick(node: BTNode, overrides: Partial<TickContext> = {}): NodeResult {
            return BTNode.Tick(node, createTickContext({
                tickId: nextTickId++,
                ...overrides,
            }));
        },
        abort(node: BTNode, overrides: Partial<TickContext> = {}): void {
            BTNode.Abort(node, createTickContext({
                tickId: nextTickId++,
                ...overrides,
            }));
        },
    };
}

export function tickNode(node: BTNode, ctxOverrides: Partial<TickContext> = {}): NodeResult {
    return createNodeTicker().tick(node, ctxOverrides);
}

export function createTracingTickContext(overrides: Partial<TickContext> = {}): TickContext {
    const events = overrides.events ?? [];
    return {
        tickId: 1,
        now: 0,
        refEvents: [],
        isTracingEnabled: true,
        ...overrides,
        events,
        trace: (node: BTNode, result: NodeResult, _startedAt?: number, _finishedAt?: number) => {
            events.push({
                tickId: overrides.tickId ?? 1,
                timestamp: overrides.now ?? 0,
                nodeId: node.id,
                result,
            });
        },
    };
}

export class StubAction extends Action {
    public override readonly defaultName = "StubAction";
    public abortCount = 0;
    public resetCount = 0;
    public enterCount = 0;
    public resumeCount = 0;
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

    protected override onEnter(): void {
        this.enterCount++;
    }

    protected override onResume(): void {
        this.resumeCount++;
    }

    protected override onReset(): void {
        this.resetCount++;
    }
}
