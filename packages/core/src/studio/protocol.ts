import type { SerializableNode, TickRecord } from "../base/types";

export const AGENT_PROTOCOL_VERSION = 1 as const;
export type AgentProtocolVersion = typeof AGENT_PROTOCOL_VERSION;

export type FrameKind = "req" | "res" | "evt";

export interface AgentTreeInfo {
    treeKey: string;
    treeId: number;
    name: string;
    description?: string;
}

export interface RequestFrame<TMethod extends string = string, TParams = unknown> {
    v: AgentProtocolVersion;
    kind: "req";
    id: string;
    method: TMethod;
    params?: TParams;
}

export interface SuccessResponseFrame<TResult = unknown> {
    v: AgentProtocolVersion;
    kind: "res";
    id: string;
    ok: true;
    result?: TResult;
}

export interface ErrorResponseFrame {
    v: AgentProtocolVersion;
    kind: "res";
    id: string;
    ok: false;
    error: {
        code: string;
        message: string;
    };
}

export interface EventFrame<TEvent extends string = string, TData = unknown> {
    v: AgentProtocolVersion;
    kind: "evt";
    event: TEvent;
    data?: TData;
}

export type AgentRequestMethod =
    | "agent.listTrees"
    | "agent.getTree"
    | "agent.setCapture"
    | "agent.restoreBaseline"
    | "agent.setStreaming"
    | "agent.ping";

export type AgentSetCaptureScope = "tree" | "all";

export interface AgentGetTreeParams {
    treeKey: string;
}

export interface AgentSetCaptureParams {
    scope: AgentSetCaptureScope;
    treeKey?: string;
    traceState?: boolean;
    profiling?: boolean;
}

export interface AgentSetStreamingParams {
    enabled: boolean;
}

export interface AgentRestoreBaselineParams {
    scope: AgentSetCaptureScope;
    treeKey?: string;
}

export interface AgentPingParams {
    at?: number;
}

export interface AgentGetTreeResult {
    treeKey: string;
    tree: SerializableNode;
}

export interface AgentListTreesResult {
    trees: AgentTreeInfo[];
}

export interface AgentPingResult {
    at: number;
}

export interface AgentHelloEventData {
    clientName: string;
    protocolVersion: AgentProtocolVersion;
    trees: AgentTreeInfo[];
}

export interface AgentTreesChangedEventData {
    trees: AgentTreeInfo[];
}

export interface AgentTreeUpdatedEventData {
    treeKey: string;
    tree: SerializableNode;
}

export interface AgentTickBatchEventData {
    treeKey: string;
    seq: number;
    ticks: TickRecord[];
    droppedSinceLast: number;
}

export interface AgentHeartbeatEventData {
    at: number;
}

export interface AgentWarningEventData {
    code: string;
    message: string;
}

export type AgentEventName =
    | "agent.hello"
    | "agent.treesChanged"
    | "agent.treeUpdated"
    | "agent.tickBatch"
    | "agent.heartbeat"
    | "agent.warning";

export type AgentRequestFrame = RequestFrame<AgentRequestMethod, unknown>;
export type AgentResponseFrame = SuccessResponseFrame<unknown> | ErrorResponseFrame;
export type AgentEventFrame = EventFrame<AgentEventName, unknown>;
export type AgentProtocolFrame = AgentRequestFrame | AgentResponseFrame | AgentEventFrame;

export function createRequestFrame<TMethod extends AgentRequestMethod, TParams>(
    id: string,
    method: TMethod,
    params?: TParams
): RequestFrame<TMethod, TParams> {
    return {
        v: AGENT_PROTOCOL_VERSION,
        kind: "req",
        id,
        method,
        params,
    };
}

export function createSuccessResponseFrame<TResult>(
    id: string,
    result?: TResult
): SuccessResponseFrame<TResult> {
    return {
        v: AGENT_PROTOCOL_VERSION,
        kind: "res",
        id,
        ok: true,
        result,
    };
}

export function createErrorResponseFrame(
    id: string,
    code: string,
    message: string
): ErrorResponseFrame {
    return {
        v: AGENT_PROTOCOL_VERSION,
        kind: "res",
        id,
        ok: false,
        error: {
            code,
            message,
        },
    };
}

export function createEventFrame<TEvent extends AgentEventName, TData>(
    event: TEvent,
    data?: TData
): EventFrame<TEvent, TData> {
    return {
        v: AGENT_PROTOCOL_VERSION,
        kind: "evt",
        event,
        data,
    };
}
