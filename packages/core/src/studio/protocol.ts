import { SerializableNode, TickRecord } from "../base";
import { CommandResponse, CorrelationId, StudioCommand } from "./types";

export const MessageType = {
    Hello: 1,
    TreeRegistered: 2,
    TreeRemoved: 3,
    TickBatch: 4,
    CommandResponse: 5,
    Command: 6,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const PROTOCOL_VERSION = 1;

// Outbound (client → server)
export type OutboundMessage =
    | { t: typeof MessageType.Hello; version: number; clientId: string; sessionId: string }
    | { t: typeof MessageType.TreeRegistered; treeId: string; serializedTree: SerializableNode }
    | { t: typeof MessageType.TreeRemoved; treeId: string }
    | { t: typeof MessageType.TickBatch; treeId: string; ticks: TickRecord[] }
    | { t: typeof MessageType.CommandResponse; correlationId: CorrelationId; response: CommandResponse };

// Inbound (server → client)
export type InboundMessage =
    | { t: typeof MessageType.Command; command: StudioCommand };
