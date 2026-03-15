import {
  TreeRegistry,
  StudioLink,
  StudioAgent,
} from '@bt-studio/core'
import { createCpuHeavyTree, createNpcDemoTree } from '@bt-studio/core/demos'
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node'
// @ts-expect-error — @bt-studio/studio-repl is created by the parallel builder; resolves after merge
import { ReplPlugin, DEMO_REPL_KEYS } from '@bt-studio/studio-repl'

export function startDemoAgent(wsUrl: string, type: 'npc' | 'cpu' = 'npc'): { shutdown(): void } {
  const tree = type === 'cpu' ? createCpuHeavyTree() : createNpcDemoTree()
  const treeName = type === 'cpu' ? 'demo-cpu-heavy' : 'demo-npc-adventure'

  const registry = new TreeRegistry()
  registry.register(treeName, tree)

  const link = new StudioLink({
    createTransport: WsNodeStringTransport.createFactory(wsUrl),
  })

  const agent = new StudioAgent({
    clientId: `cli-demo-${type}`,
    sessionId: `demo-${type}-${Date.now()}`,
    registry,
    link,
  })

  const replPlugin = new ReplPlugin({ serverPublicKey: DEMO_REPL_KEYS.publicKey })
  agent.registerPlugin(replPlugin)

  agent.start()

  const interval = setInterval(() => {
    tree.tick()
    agent.tick()
  }, 200)

  return {
    shutdown() {
      clearInterval(interval)
      agent.destroy()
    },
  }
}
