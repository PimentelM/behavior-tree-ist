import { TickRecord, SerializableNode } from "@behavior-tree-ist/core";

export const PROTOCOL_VERSION = 1;

export const MessageType = {
    ClientHello: 1,
    RegisterTree: 2,
    RemoveTree: 3,
    TickBatch: 4,
    TreeUpdate: 5,
    CommandAck: 6,
    ServerHello: 50,
    Command: 51,
} as const;

export const CommandType = {
    EnableStreaming: 'enable-streaming',
    DisableStreaming: 'disable-streaming',
    EnableStateTrace: 'enable-state-trace',
    DisableStateTrace: 'disable-state-trace',
    EnableProfiling: 'enable-profiling',
    DisableProfiling: 'disable-profiling',
} as const;

// Agent -> Server Messages

export interface ClientHelloMessage {
    v: number;
    type: typeof MessageType.ClientHello;
    payload: {
        clientId: string;
    };
}

export interface RegisterTreeMessage {
    v: number;
    type: typeof MessageType.RegisterTree;
    payload: {
        treeId: string;
        serializedTree: SerializableNode;
    };
}

export interface RemoveTreeMessage {
    v: number;
    type: typeof MessageType.RemoveTree;
    payload: {
        treeId: string;
    };
}

export interface TickBatchMessage {
    v: number;
    type: typeof MessageType.TickBatch;
    payload: {
        treeId: string;
        ticks: TickRecord[];
    };
}

export interface TreeUpdateMessage {
    v: number;
    type: typeof MessageType.TreeUpdate;
    payload: {
        treeId: string;
        serializedTree: SerializableNode;
    };
}

export interface CommandAckMessage {
    v: number;
    type: typeof MessageType.CommandAck;
    payload: {
        correlationId: string;
        success: boolean;
        error?: string;
    };
}

export type AgentToServerMessage =
    | ClientHelloMessage
    | RegisterTreeMessage
    | RemoveTreeMessage
    | TickBatchMessage
    | TreeUpdateMessage
    | CommandAckMessage;

// Server -> Agent Messages

export interface ServerHelloMessage {
    v: number;
    type: typeof MessageType.ServerHello;
    payload: {
        serverVersion: string;
    };
}

export interface CommandMessage {
    v: number;
    type: typeof MessageType.Command;
    payload: {
        correlationId: string;
        treeId: string;
        command: string;
    };
}

export type ServerToAgentMessage = ServerHelloMessage | CommandMessage;
