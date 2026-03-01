import type { AgentTreeInfo } from '@behavior-tree-ist/core/studio';

export type AgentId = string;
export type UiClientId = string;
export type StudioMode = 'listen' | 'connect';

export interface AgentSnapshot {
  id: AgentId;
  name: string;
  state: string;
  trees: AgentTreeInfo[];
}

export interface SessionSnapshot {
  mode: StudioMode;
  selectedAgentId: AgentId | null;
  selectedTreeKey: string | null;
  agents: AgentSnapshot[];
  trees: AgentTreeInfo[];
}

export class SessionStore {
  public mode: StudioMode = 'listen';
  public selectedAgentId: AgentId | null = null;
  public selectedTreeKey: string | null = null;

  private readonly uiHeartbeats = new Map<UiClientId, number>();

  updateHeartbeat(uiId: UiClientId, at: number): void {
    this.uiHeartbeats.set(uiId, at);
  }

  removeUi(uiId: UiClientId): void {
    this.uiHeartbeats.delete(uiId);
  }

  getLastHeartbeat(uiId: UiClientId): number | undefined {
    return this.uiHeartbeats.get(uiId);
  }

  getUiCount(): number {
    return this.uiHeartbeats.size;
  }

  createSnapshot(input: { agents: AgentSnapshot[]; trees: AgentTreeInfo[] }): SessionSnapshot {
    return {
      mode: this.mode,
      selectedAgentId: this.selectedAgentId,
      selectedTreeKey: this.selectedTreeKey,
      agents: input.agents,
      trees: input.trees,
    };
  }
}
