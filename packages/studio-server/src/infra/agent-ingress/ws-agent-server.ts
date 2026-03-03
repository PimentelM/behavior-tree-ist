import { randomUUID } from 'node:crypto'
import type { Server as HttpServer } from 'node:http'
import { WebSocketServer, WebSocket, type RawData } from 'ws'
import type { AgentIngressConnection } from '../../app/agent-ingress'

interface LogLike {
  warn(context: unknown, message?: string): void
  error(context: unknown, message?: string): void
}

const defaultLogger: LogLike = {
  warn: () => {},
  error: () => {},
}

const closeCodeNormal = 1000
const closeCodeServerError = 1011
const closeCodeServerShutdown = 1001
const maxWebSocketReasonLength = 123

const normalizeRawDataToString = (rawData: RawData): string | null => {
  if (typeof rawData === 'string') {
    return rawData
  }

  if (Buffer.isBuffer(rawData)) {
    return rawData.toString('utf-8')
  }

  if (Array.isArray(rawData)) {
    return Buffer.concat(rawData).toString('utf-8')
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData).toString('utf-8')
  }

  return null
}

const normalizeCloseReason = (reason: string | undefined): string | undefined => {
  if (reason === undefined) {
    return undefined
  }

  if (reason.length <= maxWebSocketReasonLength) {
    return reason
  }

  return reason.slice(0, maxWebSocketReasonLength)
}

export const defaultWsAgentPath = '/v1/agents/ws'

export interface WsAgentServerOptions {
  path?: string
  onMessage: (connection: AgentIngressConnection, payload: string) => Promise<void> | void
  onClose: (connection: AgentIngressConnection) => Promise<void> | void
  logger?: LogLike
}

export class WsAgentServer {
  private readonly sockets = new Set<WebSocket>()
  private wss: WebSocketServer | null = null
  private readonly logger: LogLike

  constructor(private readonly options: WsAgentServerOptions) {
    this.logger = options.logger ?? defaultLogger
  }

  start(httpServer: HttpServer): void {
    if (this.wss !== null) {
      return
    }

    const wss = new WebSocketServer({
      server: httpServer,
      path: this.options.path ?? defaultWsAgentPath,
    })
    this.wss = wss
    wss.on('connection', (socket) => this.handleSocketConnection(socket))
  }

  async stop(): Promise<void> {
    if (this.wss === null) {
      return
    }

    const wss = this.wss
    this.wss = null

    for (const socket of this.sockets) {
      socket.close(closeCodeServerShutdown, 'server-shutdown')
    }
    this.sockets.clear()

    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })
  }

  private handleSocketConnection(socket: WebSocket): void {
    this.sockets.add(socket)
    let messageQueue = Promise.resolve()

    const connection: AgentIngressConnection = {
      id: randomUUID(),
      transport: 'ws',
      send: (payload: unknown): void => {
        if (socket.readyState !== WebSocket.OPEN) {
          return
        }

        const outbound = typeof payload === 'string'
          ? payload
          : JSON.stringify(payload)
        socket.send(outbound)
      },
      close: (reason?: string): void => {
        if (
          socket.readyState === WebSocket.CLOSING
          || socket.readyState === WebSocket.CLOSED
        ) {
          return
        }

        socket.close(closeCodeNormal, normalizeCloseReason(reason))
      },
    }

    socket.on('message', (rawData) => {
      const payload = normalizeRawDataToString(rawData)
      if (payload === null) {
        connection.close('invalid-payload')
        return
      }

      messageQueue = messageQueue
        .then(() => this.options.onMessage(connection, payload))
        .catch((error) => {
          this.logger.error(
            {
              error,
              connectionId: connection.id,
              transport: connection.transport,
            },
            'failed to handle websocket agent message',
          )
          socket.close(closeCodeServerError, 'server-error')
        })
    })

    socket.on('error', (error) => {
      this.logger.warn(
        {
          error,
          connectionId: connection.id,
          transport: connection.transport,
        },
        'websocket agent connection error',
      )
    })

    socket.on('close', () => {
      this.sockets.delete(socket)
      void Promise.resolve(this.options.onClose(connection)).catch((error) => {
        this.logger.error(
          {
            error,
            connectionId: connection.id,
            transport: connection.transport,
          },
          'failed to process websocket agent close',
        )
      })
    })
  }
}
