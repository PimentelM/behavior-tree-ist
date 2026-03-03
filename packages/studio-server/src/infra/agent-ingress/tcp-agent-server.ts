import { randomUUID } from 'node:crypto'
import { createServer, type Server, type Socket } from 'node:net'
import type { AgentIngressConnection } from '../../app/agent-ingress'
import { FrameDecoder, encodeStringFrame } from './tcp-length-framing'

interface LogLike {
  warn(context: unknown, message?: string): void
  error(context: unknown, message?: string): void
}

const defaultLogger: LogLike = {
  warn: () => {},
  error: () => {},
}

const textDecoder = new TextDecoder()

export interface TcpAgentServerOptions {
  onMessage: (connection: AgentIngressConnection, payload: string) => Promise<void> | void
  onClose: (connection: AgentIngressConnection) => Promise<void> | void
  logger?: LogLike
}

export class TcpAgentServer {
  private readonly sockets = new Set<Socket>()
  private readonly logger: LogLike
  private server: Server | null = null
  private listeningPort: number | null = null

  constructor(private readonly options: TcpAgentServerOptions) {
    this.logger = options.logger ?? defaultLogger
  }

  async start(host: string, port: number): Promise<number> {
    if (this.server !== null && this.listeningPort !== null) {
      return this.listeningPort
    }

    const server = createServer((socket) => this.handleSocketConnection(socket))
    this.server = server

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off('error', onError)
        reject(error)
      }

      server.once('error', onError)
      server.listen({ host, port }, () => {
        server.off('error', onError)
        resolve()
      })
    })

    const address = server.address()
    if (typeof address === 'string' || address === null) {
      throw new Error('Unable to resolve TCP listener port.')
    }

    this.listeningPort = address.port
    return address.port
  }

  async stop(): Promise<void> {
    if (this.server === null) {
      return
    }

    const server = this.server
    this.server = null
    this.listeningPort = null

    for (const socket of this.sockets) {
      socket.destroy()
    }
    this.sockets.clear()

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }

  getListeningPort(): number | null {
    return this.listeningPort
  }

  private handleSocketConnection(socket: Socket): void {
    this.sockets.add(socket)
    let messageQueue = Promise.resolve()

    const connection: AgentIngressConnection = {
      id: randomUUID(),
      transport: 'tcp',
      send: (payload: unknown): void => {
        if (socket.destroyed) {
          return
        }

        const outbound = typeof payload === 'string'
          ? payload
          : JSON.stringify(payload)
        socket.write(encodeStringFrame(outbound))
      },
      close: (): void => {
        if (socket.destroyed) {
          return
        }
        socket.end()
      },
    }

    const frameDecoder = new FrameDecoder((payload) => {
      const message = textDecoder.decode(payload)
      messageQueue = messageQueue
        .then(() => this.options.onMessage(connection, message))
        .catch((error) => {
          this.logger.error(
            {
              error,
              connectionId: connection.id,
              transport: connection.transport,
            },
            'failed to handle TCP agent message',
          )
          socket.destroy()
        })
    })

    socket.on('data', (chunk) => {
      frameDecoder.feed(new Uint8Array(chunk))
    })

    socket.on('error', (error) => {
      this.logger.warn(
        {
          error,
          connectionId: connection.id,
          transport: connection.transport,
        },
        'tcp agent connection error',
      )
    })

    socket.on('close', () => {
      frameDecoder.reset()
      this.sockets.delete(socket)
      void Promise.resolve(this.options.onClose(connection)).catch((error) => {
        this.logger.error(
          {
            error,
            connectionId: connection.id,
            transport: connection.transport,
          },
          'failed to process TCP agent close',
        )
      })
    })
  }
}
