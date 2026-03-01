import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';

export type StudioConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type StudioChannelMode = 'listen' | 'connect';

export interface StudioAgentSummary {
  id: string;
  name: string;
  state: string;
}

export interface StudioTreeSummary {
  treeKey: string;
  name: string;
  description?: string;
}

export interface StudioSessionState {
  mode: StudioChannelMode;
  selectedAgentId: string | null;
  selectedTreeKey: string | null;
  agents: StudioAgentSummary[];
  trees: StudioTreeSummary[];
}

export interface StudioConnectionState {
  status: StudioConnectionStatus;
  mode: StudioChannelMode;
  agents: StudioAgentSummary[];
  trees: StudioTreeSummary[];
  selectedAgentId: string | null;
  selectedTreeKey: string | null;
  tree: SerializableNode | null;
  ticks: TickRecord[];
}

export interface StudioConnectionControls {
  setMode: (mode: StudioChannelMode) => void;
  connectTarget: (url: string) => void;
  selectAgent: (agentId: string) => void;
  selectTree: (treeKey: string) => void;
  setCapture: (params: { scope: 'tree' | 'all'; traceState?: boolean; profiling?: boolean }) => void;
}

export type StudioConnectionModel = StudioConnectionState & StudioConnectionControls;
