import type { StudioRuntimeState } from '../runtime'

export interface StudioRuntimeStateProvider {
  getRuntimeState(): StudioRuntimeState
}
