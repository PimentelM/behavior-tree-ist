import z from 'zod';
import { makeEventSchemaFromMap, SchemaMapType } from '../lib/events/utils';
import { ServerSettings } from './types';

export const AgentConnected = z.object({
    clientId: z.string(),
    sessionId: z.string(),
});
export type AgentConnected = z.infer<typeof AgentConnected>;

export const AgentDisconnected = z.object({
    clientId: z.string(),
    sessionId: z.string(),
});
export type AgentDisconnected = z.infer<typeof AgentDisconnected>;

export const CatalogChanged = z.object({
    clientId: z.string(),
    sessionId: z.string(),
});
export type CatalogChanged = z.infer<typeof CatalogChanged>;

export const AgentEventMap = {
    AgentConnected,
    AgentDisconnected,
    CatalogChanged,
} as const;
export type AgentEventMap = SchemaMapType<typeof AgentEventMap>;
export type AgentEventName = keyof AgentEventMap;
export type AgentEventBody = AgentEventMap[AgentEventName];
export const AgentEvent = makeEventSchemaFromMap(AgentEventMap);
export type AgentEvent = z.infer<typeof AgentEvent>;

export const SettingsUpdated = z.object({
    settings: ServerSettings,
});
export type SettingsUpdated = z.infer<typeof SettingsUpdated>;

export const ServerEventMap = {
    SettingsUpdated,
} as const;
export type ServerEventMap = SchemaMapType<typeof ServerEventMap>;
export type ServerEventName = keyof ServerEventMap;
export type ServerEventBody = ServerEventMap[ServerEventName];
export const ServerEvent = makeEventSchemaFromMap(ServerEventMap);
export type ServerEvent = z.infer<typeof ServerEvent>;

export const DomainEventMap = {
    ...AgentEventMap,
    ...ServerEventMap,
} as const;
export type DomainEventMap = SchemaMapType<typeof DomainEventMap>;
export type DomainEventName = keyof DomainEventMap;
export type DomainEventBody = DomainEventMap[DomainEventName];
export const DomainEvent = makeEventSchemaFromMap(DomainEventMap);
export type DomainEvent = z.infer<typeof DomainEvent>;

export type DispatchedEvent =
    | {
        subject: 'Agent';
        event: AgentEvent;
    }
    | {
        subject: 'Server';
        event: ServerEvent;
    };

export type Subject = DispatchedEvent['subject'];
