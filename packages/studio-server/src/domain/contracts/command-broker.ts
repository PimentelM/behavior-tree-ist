import type { AgentIdentity } from './agent-connection-registry'

export interface CommandRequest {
  correlationId: string
  issuedAt: string
  timeoutMs: number
  target: AgentIdentity
  payload: unknown
}

export interface CommandTimeoutResult {
  kind: 'timeout'
  correlationId: string
}

export interface CommandResponseResult {
  kind: 'response'
  correlationId: string
  payload: unknown
}

export type CommandResult = CommandTimeoutResult | CommandResponseResult

export interface CommandBroker {
  registerPending(request: CommandRequest): Promise<void>
  resolve(correlationId: string, payload: unknown): Promise<boolean>
  waitForResult(correlationId: string): Promise<CommandResult>
  failPendingForTarget(target: AgentIdentity): Promise<void>
}
