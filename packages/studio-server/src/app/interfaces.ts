import { CommandResponse, StudioCommand } from '@bt-studio/core';
import type { AgentConnection, UiConnection } from '../domain/types';
import type { BaseEventDispatcher } from '../_lib/events/base-event-dispatcher';
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

export interface UiConnectionRegistryInterface {
    register(connectionId: string): void;
    unregister(connectionId: string): UiConnection | undefined;
    getConnection(connectionId: string): UiConnection | undefined;
    getAllConnections(): UiConnection[];
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
