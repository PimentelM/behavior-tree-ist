import { composeStudioServer } from './app/composition-root'
import type { StudioServerOptions } from './config'
import type { StudioServerHandle } from './studio-server-handle'

export function createStudioServer(options: StudioServerOptions = {}): StudioServerHandle {
  return composeStudioServer(options)
}
