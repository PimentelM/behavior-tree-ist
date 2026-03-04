import { CommandResponse, StudioCommand } from '@behavior-tree-ist/core';
import type { AgentConnection } from '../domain/types';
import type { BaseEventDispatcher } from '../lib/events/base-event-dispatcher';
import { AgentEvent, DispatchedEvent, ServerEvent } from '../domain/events';

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

export interface DomainEventDispatcherInterface extends Pick<BaseEventDispatcher<DispatchedEvent>, 'dispatchEvent' | 'on'> {
    dispatchAgentEvent(event: AgentEvent): Promise<void>;
    dispatchServerEvent(event: ServerEvent): Promise<void>;
}
