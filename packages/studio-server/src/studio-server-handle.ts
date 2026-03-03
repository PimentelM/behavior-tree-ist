import type { StudioRuntimeState } from './runtime'

export interface StudioServerHandle {
  start(): Promise<void>
  stop(): Promise<void>
  getRuntimeState(): StudioRuntimeState
}
