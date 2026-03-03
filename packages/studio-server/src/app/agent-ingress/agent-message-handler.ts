import { MessageType, PROTOCOL_VERSION } from '@behavior-tree-ist/core'
import type { AgentCatalogService } from '../../domain/services/agent-catalog-service'
import type { AgentIngressConnection } from './agent-ingress-connection'

interface LogLike {
  warn(context: unknown, message?: string): void
  error(context: unknown, message?: string): void
}

interface HelloMessage {
  t: typeof MessageType.Hello
  version: number
  clientId: string
  sessionId: string
}

interface TreeRegisteredMessage {
  t: typeof MessageType.TreeRegistered
  treeId: string
  serializedTree: unknown
}

interface TreeRemovedMessage {
  t: typeof MessageType.TreeRemoved
  treeId: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

const parseProtocolMessage = (
  payload: unknown,
): HelloMessage | TreeRegisteredMessage | TreeRemovedMessage | null => {
  if (!isRecord(payload)) {
    return null
  }

  const type = payload.t
  if (type === MessageType.Hello) {
    if (
      typeof payload.version !== 'number'
      || typeof payload.clientId !== 'string'
      || typeof payload.sessionId !== 'string'
    ) {
      return null
    }

    return {
      t: type,
      version: payload.version,
      clientId: payload.clientId,
      sessionId: payload.sessionId,
    }
  }

  if (type === MessageType.TreeRegistered) {
    if (typeof payload.treeId !== 'string' || !('serializedTree' in payload)) {
      return null
    }

    return {
      t: type,
      treeId: payload.treeId,
      serializedTree: payload.serializedTree,
    }
  }

  if (type === MessageType.TreeRemoved) {
    if (typeof payload.treeId !== 'string') {
      return null
    }

    return {
      t: type,
      treeId: payload.treeId,
    }
  }

  return null
}

const isNonEmptyId = (value: string): boolean => value.trim().length > 0

export interface AgentMessageHandlerOptions {
  catalogService: AgentCatalogService
  logger: LogLike
}

export class AgentMessageHandler {
  constructor(private readonly options: AgentMessageHandlerOptions) {}

  async handleMessage(connection: AgentIngressConnection, rawPayload: string): Promise<void> {
    let parsedPayload: unknown
    try {
      parsedPayload = JSON.parse(rawPayload)
    } catch (error) {
      this.options.logger.warn(
        {
          error,
          connectionId: connection.id,
          transport: connection.transport,
        },
        'received invalid agent JSON payload',
      )
      await connection.close('invalid-json-payload')
      return
    }

    const message = parseProtocolMessage(parsedPayload)
    if (message === null) {
      return
    }

    if (message.t === MessageType.Hello) {
      if (
        message.version !== PROTOCOL_VERSION
        || !isNonEmptyId(message.clientId)
        || !isNonEmptyId(message.sessionId)
      ) {
        await connection.close('invalid-hello-message')
        return
      }

      await this.options.catalogService.handleHello(
        connection,
        message.clientId,
        message.sessionId,
      )
      return
    }

    if (message.t === MessageType.TreeRegistered) {
      if (!isNonEmptyId(message.treeId)) {
        await connection.close('invalid-tree-id')
        return
      }

      await this.options.catalogService.handleTreeRegistered(
        connection,
        message.treeId,
        message.serializedTree,
      )
      return
    }

    if (!isNonEmptyId(message.treeId)) {
      await connection.close('invalid-tree-id')
      return
    }

    await this.options.catalogService.handleTreeRemoved(connection, message.treeId)
  }

  async handleConnectionClosed(connection: AgentIngressConnection): Promise<void> {
    try {
      await this.options.catalogService.handleConnectionClosed(connection)
    } catch (error) {
      this.options.logger.error(
        {
          error,
          connectionId: connection.id,
          transport: connection.transport,
        },
        'failed to process agent connection close',
      )
    }
  }
}
