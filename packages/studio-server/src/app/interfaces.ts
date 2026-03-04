import { CommandResponse, StudioCommand } from '@behavior-tree-ist/core';
import { AgentConnection } from '../domain/types';

// ── App service interfaces ──

export interface AgentConnectionRegistryInterface {
    register(connectionId: string, clientId: string, sessionId: string): void;
    unregisterByConnectionId(connectionId: string): AgentConnection | undefined;
    getByConnectionId(connectionId: string): AgentConnection | undefined;
    getByIdentity(clientId: string, sessionId: string): AgentConnection | undefined;
    getAllConnections(): AgentConnection[];
    isOnline(clientId: string, sessionId: string): boolean;
}

export interface CommandBrokerInterface {
    sendCommand(connectionId: string, command: StudioCommand): Promise<CommandResponse>;
    handleResponse(correlationId: string, response: CommandResponse): void;
    shutdown(): void;
}

export interface CommandSenderInterface {
    sendToClient(clientId: string, message: object): void;
}
