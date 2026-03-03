import type { FastifyInstance } from 'fastify'
import type { AddressInfo } from 'node:net'
import {
  type ResolvedStudioServerConfig,
} from '../config'
import type { StudioRuntimeState } from '../runtime'
import type { StudioRuntimeStateProvider } from './studio-runtime-state-provider'
import type { StudioServerHandle } from '../studio-server-handle'

const shutdownSignals = ['SIGINT', 'SIGTERM'] as const

type ShutdownSignal = (typeof shutdownSignals)[number]

const addressToPort = (address: string | AddressInfo | null): number | null => {
  if (address === null || typeof address === 'string') {
    return null
  }

  return address.port
}

export class StudioServerService
  implements StudioServerHandle, StudioRuntimeStateProvider {
  private readonly signalHandlers = new Map<ShutdownSignal, () => void>()
  private runtimeState: StudioRuntimeState
  private startPromise: Promise<void> | null = null
  private stopPromise: Promise<void> | null = null

  constructor(
    private readonly config: ResolvedStudioServerConfig,
    private readonly server: FastifyInstance,
  ) {
    this.runtimeState = {
      status: 'idle',
      startedAt: null,
      stoppedAt: null,
      config: { ...this.config },
      listeners: {
        http: {
          host: this.config.httpHost,
          port: null,
          listening: false,
        },
        tcp: {
          host: this.config.tcpHost,
          port: this.config.tcpPort,
          listening: false,
        },
      },
    }
  }

  async start(): Promise<void> {
    if (this.runtimeState.status === 'running') {
      return
    }

    if (this.startPromise !== null) {
      await this.startPromise
      return
    }

    if (this.stopPromise !== null) {
      await this.stopPromise
    }

    this.runtimeState = {
      ...this.runtimeState,
      status: 'starting',
      stoppedAt: null,
    }

    this.startPromise = this.startInternal()

    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  async stop(): Promise<void> {
    if (this.runtimeState.status === 'idle') {
      return
    }

    if (this.stopPromise !== null) {
      await this.stopPromise
      return
    }

    this.runtimeState = {
      ...this.runtimeState,
      status: 'stopping',
    }

    this.stopPromise = this.stopInternal()

    try {
      await this.stopPromise
    } finally {
      this.stopPromise = null
    }
  }

  getRuntimeState(): StudioRuntimeState {
    return {
      ...this.runtimeState,
      config: { ...this.runtimeState.config },
      listeners: {
        http: { ...this.runtimeState.listeners.http },
        tcp: { ...this.runtimeState.listeners.tcp },
      },
    }
  }

  private async startInternal(): Promise<void> {
    this.installSignalHandlers()

    try {
      await this.server.listen({
        host: this.config.httpHost,
        port: this.config.httpPort,
      })

      const httpPort = addressToPort(this.server.server.address())
      this.runtimeState = {
        ...this.runtimeState,
        status: 'running',
        startedAt: new Date().toISOString(),
        listeners: {
          ...this.runtimeState.listeners,
          http: {
            host: this.config.httpHost,
            port: httpPort,
            listening: true,
          },
        },
      }
    } catch (error) {
      this.removeSignalHandlers()
      this.runtimeState = {
        ...this.runtimeState,
        status: 'idle',
      }
      throw error
    }
  }

  private async stopInternal(): Promise<void> {
    try {
      await this.server.close()
    } finally {
      this.removeSignalHandlers()
      this.runtimeState = {
        ...this.runtimeState,
        status: 'idle',
        stoppedAt: new Date().toISOString(),
        listeners: {
          ...this.runtimeState.listeners,
          http: {
            ...this.runtimeState.listeners.http,
            listening: false,
          },
          tcp: {
            ...this.runtimeState.listeners.tcp,
            listening: false,
          },
        },
      }
    }
  }

  private installSignalHandlers(): void {
    if (this.signalHandlers.size > 0) {
      return
    }

    for (const signal of shutdownSignals) {
      const handler = () => {
        void this.stop().catch((error: unknown) => {
          this.server.log.error({ error, signal }, 'graceful shutdown failed')
        })
      }
      this.signalHandlers.set(signal, handler)
      process.on(signal, handler)
    }
  }

  private removeSignalHandlers(): void {
    for (const [signal, handler] of this.signalHandlers.entries()) {
      process.off(signal, handler)
    }
    this.signalHandlers.clear()
  }
}
