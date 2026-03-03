import type { ResolvedStudioServerConfig } from '../config/studio-server-options'

export const studioRuntimeStatuses = [
  'idle',
  'starting',
  'running',
  'stopping',
] as const

export type StudioRuntimeStatus = (typeof studioRuntimeStatuses)[number]

export interface ListenerRuntimeState {
  host: string
  port: number | null
  listening: boolean
}

export interface StudioRuntimeState {
  status: StudioRuntimeStatus
  startedAt: string | null
  stoppedAt: string | null
  config: ResolvedStudioServerConfig
  listeners: {
    http: ListenerRuntimeState
    tcp: ListenerRuntimeState
  }
}
