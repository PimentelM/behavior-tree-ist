export { BehaviourTreeRegistry } from "./registry";
export type { RegisterTreeOptions, RegisteredTreeRecord } from "./registry";

export { StudioAgent } from "./studio-agent";
export type {
    StudioAgentOptions,
    TickDriverResult,
    FlushResult,
    RetryPolicy,
    StudioAgentConnectionState,
} from "./studio-agent";

export type { BinaryDuplexTransport, TransportDialer } from "./transport";

export {
    AGENT_PROTOCOL_VERSION,
    createRequestFrame,
    createSuccessResponseFrame,
    createErrorResponseFrame,
    createEventFrame,
} from "./protocol";

export type {
    AgentProtocolVersion,
    FrameKind,
    AgentTreeInfo,
    RequestFrame,
    SuccessResponseFrame,
    ErrorResponseFrame,
    EventFrame,
    AgentRequestMethod,
    AgentSetCaptureScope,
    AgentGetTreeParams,
    AgentSetCaptureParams,
    AgentRestoreBaselineParams,
    AgentSetStreamingParams,
    AgentPingParams,
    AgentGetTreeResult,
    AgentListTreesResult,
    AgentPingResult,
    AgentHelloEventData,
    AgentTreesChangedEventData,
    AgentTreeUpdatedEventData,
    AgentTickBatchEventData,
    AgentHeartbeatEventData,
    AgentWarningEventData,
    AgentEventName,
    AgentRequestFrame,
    AgentResponseFrame,
    AgentEventFrame,
    AgentProtocolFrame,
} from "./protocol";

export { isAgentProtocolFrame, parseAgentProtocolFrame, encodeAgentProtocolFrame } from "./protocol-guards";
