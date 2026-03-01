import type { OffFunction, TickRecord } from "../base/types";
import type { BinaryDuplexTransport, TransportDialer } from "./transport";
import {
    createErrorResponseFrame,
    createEventFrame,
    createSuccessResponseFrame,
    type AgentGetTreeParams,
    type AgentPingParams,
    type AgentRestoreBaselineParams,
    type AgentRequestFrame,
    type AgentSetCaptureParams,
    type AgentSetStreamingParams,
} from "./protocol";
import { encodeAgentProtocolFrame, parseAgentProtocolFrame } from "./protocol-guards";
import { BehaviourTreeRegistry } from "./registry";

export interface RetryPolicy {
    initialMs: number;
    maxMs: number;
    factor: number;
    jitterRatio: number;
}

export interface StudioAgentOptions {
    registry: BehaviourTreeRegistry;
    clientName?: string;
    flushIntervalMs?: number;
    maxBatchTicks?: number;
    maxQueuedTicksPerTree?: number;
    retryPolicy?: RetryPolicy;
    heartbeatIntervalMs?: number;
}

export interface TickDriverResult {
    attemptedReconnect: boolean;
    flushedTrees: number;
    droppedTicks: number;
}

export interface FlushResult {
    flushedTrees: number;
    flushedTicks: number;
    droppedTicks: number;
}

export type StudioAgentConnectionState = "disconnected" | "connecting" | "connected";

const DEFAULT_RETRY_POLICY: RetryPolicy = {
    initialMs: 250,
    maxMs: 5000,
    factor: 2,
    jitterRatio: 0.2,
};

type TreeQueue = {
    records: TickRecord[];
    droppedSinceLast: number;
};

function nowMs(): number {
    const perf = (globalThis as unknown as { performance?: { now: () => number } }).performance;
    if (perf && typeof perf.now === "function") {
        return perf.now();
    }
    return Date.now();
}

function clampPositive(value: number | undefined, fallbackValue: number): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return fallbackValue;
    }
    return value;
}

export class StudioAgent {
    private readonly registry: BehaviourTreeRegistry;
    private readonly clientName: string;
    private readonly flushIntervalMs: number;
    private readonly maxBatchTicks: number;
    private readonly maxQueuedTicksPerTree: number;
    private readonly retryPolicy: RetryPolicy;
    private readonly heartbeatIntervalMs: number;

    private readonly pendingByTree = new Map<string, TreeQueue>();
    private readonly queuedTreeUpdates = new Set<string>();

    private readonly offCallbacks: OffFunction[] = [];
    private transport: BinaryDuplexTransport | null = null;
    private transportOffCallbacks: OffFunction[] = [];
    private dialer: TransportDialer | null = null;
    private connectPromise: Promise<void> | null = null;

    private state: StudioAgentConnectionState = "disconnected";
    private reconnectBackoffMs: number;
    private nextReconnectAt = 0;
    private nextFlushAt = 0;
    private nextHeartbeatAt = 0;
    private seq = 1;
    private streamingEnabled = true;

    constructor(options: StudioAgentOptions) {
        if (!options.registry) {
            throw new Error("StudioAgent requires a registry");
        }

        this.registry = options.registry;
        this.clientName = options.clientName ?? "BehaviourTreeAgent";
        this.flushIntervalMs = clampPositive(options.flushIntervalMs, 50);
        this.maxBatchTicks = Math.max(1, Math.floor(clampPositive(options.maxBatchTicks, 128)));
        this.maxQueuedTicksPerTree = Math.max(1, Math.floor(clampPositive(options.maxQueuedTicksPerTree, 5000)));
        this.retryPolicy = {
            ...DEFAULT_RETRY_POLICY,
            ...options.retryPolicy,
        };
        this.retryPolicy.initialMs = clampPositive(this.retryPolicy.initialMs, DEFAULT_RETRY_POLICY.initialMs);
        this.retryPolicy.maxMs = clampPositive(this.retryPolicy.maxMs, DEFAULT_RETRY_POLICY.maxMs);
        this.retryPolicy.factor = clampPositive(this.retryPolicy.factor, DEFAULT_RETRY_POLICY.factor);
        this.retryPolicy.jitterRatio = Math.max(0, Math.min(1, Number.isFinite(this.retryPolicy.jitterRatio) ? this.retryPolicy.jitterRatio : DEFAULT_RETRY_POLICY.jitterRatio));
        this.heartbeatIntervalMs = clampPositive(options.heartbeatIntervalMs, 3000);
        this.reconnectBackoffMs = this.retryPolicy.initialMs;

        const offTick = this.registry.onTick((treeKey, record) => {
            this.enqueueTick(treeKey, record);
        });

        const offTreesChanged = this.registry.onTreesChanged(() => {
            if (this.state !== "connected") {
                return;
            }
            this.sendEvent("agent.treesChanged", {
                trees: this.registry.listTrees(),
            });
        });

        this.offCallbacks.push(offTick, offTreesChanged);
    }

    public attachTransport(transport: BinaryDuplexTransport): void {
        this.disposeTransportCallbacks();
        this.transport?.close(1000, "Replaced transport");
        this.transport = transport;

        const offMessage = transport.onMessage((payload) => {
            this.handleIncoming(payload);
        });
        const offClose = transport.onClose(() => {
            this.handleTransportClosed();
        });
        const offError = transport.onError((error) => {
            this.sendEvent("agent.warning", {
                code: "TRANSPORT_ERROR",
                message: error.message,
            });
        });
        this.transportOffCallbacks = [offMessage, offClose, offError];
        this.state = "connected";
        this.reconnectBackoffMs = this.retryPolicy.initialMs;
        const now = nowMs();
        this.nextHeartbeatAt = now + this.heartbeatIntervalMs;
        this.nextFlushAt = now + this.flushIntervalMs;

        this.sendEvent("agent.hello", {
            clientName: this.clientName,
            protocolVersion: 1,
            trees: this.registry.listTrees(),
        });

        this.flush(now);
    }

    public provideDialer(dial: TransportDialer): void {
        this.dialer = dial;
    }

    public tick(now: number = nowMs()): TickDriverResult {
        let attemptedReconnect = false;
        let droppedTicks = 0;
        let flushedTrees = 0;

        if (this.state === "disconnected" && this.dialer && this.connectPromise === null && now >= this.nextReconnectAt) {
            attemptedReconnect = true;
            this.startReconnect(now);
        }

        if (this.state === "connected") {
            if (now >= this.nextHeartbeatAt) {
                this.sendEvent("agent.heartbeat", { at: now });
                this.nextHeartbeatAt = now + this.heartbeatIntervalMs;
            }

            if (this.queuedTreeUpdates.size > 0) {
                for (const treeKey of this.queuedTreeUpdates) {
                    const tree = this.registry.getTreeSnapshot(treeKey);
                    if (!tree) {
                        continue;
                    }
                    this.sendEvent("agent.treeUpdated", { treeKey, tree });
                }
                this.queuedTreeUpdates.clear();
            }

            if (now >= this.nextFlushAt) {
                const flushResult = this.flush(now);
                droppedTicks = flushResult.droppedTicks;
                flushedTrees = flushResult.flushedTrees;
            }
        }

        return {
            attemptedReconnect,
            flushedTrees,
            droppedTicks,
        };
    }

    public flush(now: number = nowMs()): FlushResult {
        if (this.state !== "connected" || this.transport === null || !this.transport.isOpen) {
            return {
                flushedTrees: 0,
                flushedTicks: 0,
                droppedTicks: 0,
            };
        }

        let flushedTrees = 0;
        let flushedTicks = 0;
        let droppedTicks = 0;

        for (const [treeKey, queue] of this.pendingByTree) {
            if (queue.records.length === 0) {
                continue;
            }

            flushedTrees++;
            droppedTicks += queue.droppedSinceLast;

            const records = queue.records;
            const droppedForFirstBatch = queue.droppedSinceLast;
            queue.records = [];
            queue.droppedSinceLast = 0;

            for (let offset = 0; offset < records.length; offset += this.maxBatchTicks) {
                const ticks = records.slice(offset, offset + this.maxBatchTicks);
                flushedTicks += ticks.length;
                this.sendEvent("agent.tickBatch", {
                    treeKey,
                    seq: this.seq++,
                    ticks,
                    droppedSinceLast: offset === 0 ? droppedForFirstBatch : 0,
                });
            }
        }

        this.nextFlushAt = now + this.flushIntervalMs;
        return {
            flushedTrees,
            flushedTicks,
            droppedTicks,
        };
    }

    public disconnect(): void {
        this.connectPromise = null;
        this.dialer = null;
        this.disposeTransportCallbacks();
        this.transport?.close(1000, "Agent disconnect");
        this.transport = null;
        this.state = "disconnected";
    }

    public notifyTreeUpdated(treeKey: string): void {
        this.queuedTreeUpdates.add(treeKey);
    }

    public getConnectionState(): StudioAgentConnectionState {
        return this.state;
    }

    private startReconnect(_now: number): void {
        if (!this.dialer) {
            return;
        }

        this.state = "connecting";
        const dial = this.dialer;
        this.connectPromise = dial()
            .then((transport) => {
                this.connectPromise = null;
                this.attachTransport(transport);
            })
            .catch((error: unknown) => {
                this.connectPromise = null;
                this.state = "disconnected";
                this.scheduleReconnect(nowMs());

                const message = error instanceof Error ? error.message : "Unknown reconnect failure";
                this.sendEvent("agent.warning", {
                    code: "RECONNECT_FAILED",
                    message,
                });
            });
    }

    private scheduleReconnect(now: number): void {
        const jitterRange = this.reconnectBackoffMs * this.retryPolicy.jitterRatio;
        const jitter = jitterRange > 0 ? (Math.random() * (jitterRange * 2)) - jitterRange : 0;
        const waitMs = Math.max(0, this.reconnectBackoffMs + jitter);
        this.nextReconnectAt = now + waitMs;
        this.reconnectBackoffMs = Math.min(
            this.retryPolicy.maxMs,
            this.reconnectBackoffMs * this.retryPolicy.factor
        );
    }

    private enqueueTick(treeKey: string, record: TickRecord): void {
        if (!this.streamingEnabled) {
            return;
        }

        const queue = this.pendingByTree.get(treeKey) ?? { records: [], droppedSinceLast: 0 };
        queue.records.push(record);

        if (queue.records.length > this.maxQueuedTicksPerTree) {
            const overflow = queue.records.length - this.maxQueuedTicksPerTree;
            if (overflow > 0) {
                queue.records.splice(0, overflow);
                queue.droppedSinceLast += overflow;
            }
        }

        this.pendingByTree.set(treeKey, queue);
    }

    private handleIncoming(payload: Uint8Array | string): void {
        const frame = parseAgentProtocolFrame(payload);
        if (!frame) {
            return;
        }

        if (frame.kind !== "req") {
            return;
        }

        this.handleRequest(frame);
    }

    private handleRequest(frame: AgentRequestFrame): void {
        switch (frame.method) {
            case "agent.listTrees": {
                this.sendResponse(frame.id, {
                    trees: this.registry.listTrees(),
                });
                return;
            }
            case "agent.getTree": {
                const params = frame.params as AgentGetTreeParams | undefined;
                const treeKey = params?.treeKey;
                if (!treeKey) {
                    this.sendError(frame.id, "INVALID_REQUEST", "agent.getTree requires treeKey");
                    return;
                }

                const tree = this.registry.getTreeSnapshot(treeKey);
                if (!tree) {
                    this.sendError(frame.id, "TREE_NOT_FOUND", `Tree "${treeKey}" is not registered`);
                    return;
                }

                this.sendResponse(frame.id, {
                    treeKey,
                    tree,
                });
                return;
            }
            case "agent.setCapture": {
                const params = frame.params as AgentSetCaptureParams | undefined;
                if (!params || (params.scope !== "tree" && params.scope !== "all")) {
                    this.sendError(frame.id, "INVALID_REQUEST", "agent.setCapture requires a valid scope");
                    return;
                }

                try {
                    this.registry.setCapture(params);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Unknown capture error";
                    this.sendError(frame.id, "CAPTURE_UPDATE_FAILED", message);
                    return;
                }

                this.sendResponse(frame.id, { ok: true });
                return;
            }
            case "agent.setStreaming": {
                const params = frame.params as AgentSetStreamingParams | undefined;
                if (!params || typeof params.enabled !== "boolean") {
                    this.sendError(frame.id, "INVALID_REQUEST", "agent.setStreaming requires enabled:boolean");
                    return;
                }
                this.streamingEnabled = params.enabled;
                this.sendResponse(frame.id, { enabled: this.streamingEnabled });
                return;
            }
            case "agent.restoreBaseline": {
                const params = frame.params as AgentRestoreBaselineParams | undefined;
                if (!params || (params.scope !== "tree" && params.scope !== "all")) {
                    this.sendError(frame.id, "INVALID_REQUEST", "agent.restoreBaseline requires a valid scope");
                    return;
                }

                try {
                    this.registry.restoreBaseline(params);
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Unknown baseline restore error";
                    this.sendError(frame.id, "BASELINE_RESTORE_FAILED", message);
                    return;
                }

                this.sendResponse(frame.id, { ok: true });
                return;
            }
            case "agent.ping": {
                const params = frame.params as AgentPingParams | undefined;
                this.sendResponse(frame.id, { at: params?.at ?? nowMs() });
                return;
            }
            default:
                this.sendError(frame.id, "UNKNOWN_METHOD", `Unknown method: ${frame.method}`);
        }
    }

    private sendEvent(event: "agent.hello", data: {
        clientName: string;
        protocolVersion: 1;
        trees: ReturnType<BehaviourTreeRegistry["listTrees"]>;
    }): void;
    private sendEvent(event: "agent.treesChanged", data: { trees: ReturnType<BehaviourTreeRegistry["listTrees"]> }): void;
    private sendEvent(event: "agent.treeUpdated", data: { treeKey: string; tree: ReturnType<BehaviourTreeRegistry["getTreeSnapshot"]> }): void;
    private sendEvent(event: "agent.tickBatch", data: { treeKey: string; seq: number; ticks: TickRecord[]; droppedSinceLast: number }): void;
    private sendEvent(event: "agent.heartbeat", data: { at: number }): void;
    private sendEvent(event: "agent.warning", data: { code: string; message: string }): void;
    private sendEvent(event: string, data: unknown): void {
        if (!this.transport || !this.transport.isOpen) {
            return;
        }
        const frame = createEventFrame(event as never, data as never);
        this.transport.send(encodeAgentProtocolFrame(frame));
    }

    private sendResponse(id: string, result?: unknown): void {
        if (!this.transport || !this.transport.isOpen) {
            return;
        }
        this.transport.send(encodeAgentProtocolFrame(createSuccessResponseFrame(id, result)));
    }

    private sendError(id: string, code: string, message: string): void {
        if (!this.transport || !this.transport.isOpen) {
            return;
        }
        this.transport.send(encodeAgentProtocolFrame(createErrorResponseFrame(id, code, message)));
    }

    private handleTransportClosed(): void {
        this.disposeTransportCallbacks();
        this.transport = null;
        this.state = "disconnected";
        this.scheduleReconnect(nowMs());
    }

    private disposeTransportCallbacks(): void {
        for (const off of this.transportOffCallbacks) {
            off();
        }
        this.transportOffCallbacks = [];
    }
}
