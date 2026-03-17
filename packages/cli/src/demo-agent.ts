import {
  TreeRegistry,
  StudioLink,
  StudioAgent,
} from '@bt-studio/core'
import { createCpuHeavyTree, createNpcDemoTree } from '@bt-studio/core/demos'
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node'
import { ReplPlugin, DEMO_UI_KEYPAIR } from '@bt-studio/studio-plugins'

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

  const replPlugin = new ReplPlugin({ uiPublicKey: DEMO_UI_KEYPAIR.publicKey })
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
