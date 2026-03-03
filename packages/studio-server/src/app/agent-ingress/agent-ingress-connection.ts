import type { AgentConnection } from '../../domain'

export type AgentIngressTransport = 'ws' | 'tcp'

export interface AgentIngressConnection extends AgentConnection {
  readonly id: string
  readonly transport: AgentIngressTransport
}
