export interface AgentConnection {
    wsClientId: string;
    clientId: string;
    sessionId: string;
    connectedAt: number;
}

export interface ServerSettings {
    maxTicksPerTree: number;
    commandTimeoutMs: number;
}

export const DomainEventType = {
    AgentConnected: 'AgentConnected',
    AgentDisconnected: 'AgentDisconnected',
    CatalogChanged: 'CatalogChanged',
    SettingsUpdated: 'SettingsUpdated',
} as const;
export type DomainEventType = (typeof DomainEventType)[keyof typeof DomainEventType];

export interface AgentConnectedEvent {
    type: typeof DomainEventType.AgentConnected;
    clientId: string;
    sessionId: string;
}

export interface AgentDisconnectedEvent {
    type: typeof DomainEventType.AgentDisconnected;
    clientId: string;
    sessionId: string;
}

export interface CatalogChangedEvent {
    type: typeof DomainEventType.CatalogChanged;
    clientId: string;
    sessionId: string;
}

export interface SettingsUpdatedEvent {
    type: typeof DomainEventType.SettingsUpdated;
    settings: ServerSettings;
}

export type DomainEvent =
    | AgentConnectedEvent
    | AgentDisconnectedEvent
    | CatalogChangedEvent
    | SettingsUpdatedEvent;

export const DomainErrorCode = {
    ClientNotFound: 'CLIENT_NOT_FOUND',
    SessionNotFound: 'SESSION_NOT_FOUND',
    TreeNotFound: 'TREE_NOT_FOUND',
    AgentNotConnected: 'AGENT_NOT_CONNECTED',
    CommandTimeout: 'COMMAND_TIMEOUT',
} as const;
export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];
