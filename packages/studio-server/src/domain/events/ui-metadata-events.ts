import type { AgentIdentity } from '../contracts/agent-connection-registry'

export const uiMetadataEventTypes = [
  'agent.online',
  'agent.offline',
  'catalog.changed',
  'settings.updated',
] as const

export type UiMetadataEventType = (typeof uiMetadataEventTypes)[number]

interface UiMetadataEventBase {
  type: UiMetadataEventType
  occurredAt: string
}

export interface AgentOnlineEvent extends UiMetadataEventBase {
  type: 'agent.online'
  agent: AgentIdentity
}

export interface AgentOfflineEvent extends UiMetadataEventBase {
  type: 'agent.offline'
  agent: AgentIdentity
}

export interface CatalogChangedEvent extends UiMetadataEventBase {
  type: 'catalog.changed'
  clientId: string
  sessionId: string
}

export interface SettingsUpdatedEvent extends UiMetadataEventBase {
  type: 'settings.updated'
  maxTicksPerTree: number
  commandTimeoutMs: number
}

export type UiMetadataEvent =
  | AgentOnlineEvent
  | AgentOfflineEvent
  | CatalogChangedEvent
  | SettingsUpdatedEvent
