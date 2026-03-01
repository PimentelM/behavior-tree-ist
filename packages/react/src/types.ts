import type { MutableRefObject, ReactNode } from 'react';
import type {
  SerializableNode,
  TickRecord,
  NodeResult,
  NodeFlags,
} from '@behavior-tree-ist/core';
import type {
  TreeInspector,
  TreeInspectorOptions,
  NodeProfilingData,
  ActivityBranch,
  ActivityDisplayMode,
} from '@behavior-tree-ist/core/inspector';

export interface PanelConfig {
  nodeDetails?: boolean;
  timeline?: boolean;
  refTraces?: boolean;
  performance?: boolean;
  activityNow?: boolean;
}

export interface ThemeOverrides {
  colorSucceeded?: string;
  colorFailed?: string;
  colorRunning?: string;
  colorIdle?: string;
  bgPrimary?: string;
  bgSecondary?: string;
  bgTertiary?: string;
  textPrimary?: string;
  textSecondary?: string;
  textMuted?: string;
  borderColor?: string;
  accentColor?: string;
  fontFamily?: string;
  fontMono?: string;
}

export type ThemeMode = 'light' | 'dark';

export type LayoutDirection = 'TB' | 'LR';

export type NodeVisualKind = 'sequence' | 'fallback' | 'parallel' | 'action' | 'condition' | 'subTree' | 'ifThenElse' | 'node';

export interface NodeDecoratorData {
  nodeId: number;
  name: string;
  defaultName: string;
  nodeFlags: NodeFlags;
  result: NodeResult | null;
  displayState: Record<string, unknown> | undefined;
  displayStateIsStale: boolean;
  refEvents: Array<{
    refName: string | undefined;
    newValue: unknown;
    isAsync: boolean;
  }>;
}

export interface NodeLifecycleDecoratorData {
  nodeId: number;
  name: string;
  defaultName: string;
  nodeFlags: NodeFlags;
}

export interface BehaviourTreeDebuggerProps {
  tree: SerializableNode;
  ticks: TickRecord[];
  inspectorOptions?: TreeInspectorOptions;
  inspectorRef?: MutableRefObject<TreeInspector | null>;
  panels?: PanelConfig;
  activityDisplayMode?: ActivityDisplayMode;
  theme?: ThemeOverrides;
  themeMode?: ThemeMode;
  defaultThemeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  showThemeToggle?: boolean;
  showToolbar?: boolean;
  toolbarActions?: ReactNode;
  layoutDirection?: LayoutDirection;
  width?: string | number;
  height?: string | number;
  isolateStyles?: boolean;
  onNodeSelect?: (nodeId: number | null) => void;
  onTickChange?: (tickId: number) => void;
  className?: string;
}

export interface BTNodeData extends Record<string, unknown> {
  nodeId: number;
  name: string;
  defaultName: string;
  nodeFlags: NodeFlags;
  visualKind: NodeVisualKind;
  result: NodeResult | null;
  displayState: Record<string, unknown> | undefined;
  displayStateIsStale: boolean;
  isSelected: boolean;
  isOnActivityPath: boolean;
  isActivityTail: boolean;
  depth: number;
  representedNodeIds: number[];
  stackedDecorators: NodeDecoratorData[];
  lifecycleDecorators: NodeLifecycleDecoratorData[];
  capabilityBadges: string[];
  refEvents: NodeDecoratorData['refEvents'];
  selectedNodeId: number | null;
  onSelectNode?: (nodeId: number) => void;
}

export interface BTEdgeData extends Record<string, unknown> {
  childResult: NodeResult | null;
  isOnActivityPathEdge: boolean;
}

export interface TimeTravelState {
  mode: 'live' | 'paused';
  viewedTickId: number | null;
  viewedNow: number | null;
  nowIsTimestamp: boolean | null;
  totalTicks: number;
  oldestTickId: number | undefined;
  newestTickId: number | undefined;
}

export interface TimeTravelControls extends TimeTravelState {
  goToTick: (tickId: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  jumpToLive: () => void;
  pause: () => void;
}

export interface NodeDetailsData {
  nodeId: number;
  name: string;
  defaultName: string;
  activity?: string;
  flags: NodeFlags;
  path: string;
  tags: readonly string[];
  resultSummary: Map<NodeResult, number>;
  history: Array<{
    tickId: number;
    result: NodeResult;
    timestamp: number;
    state?: Record<string, unknown>;
  }>;
  currentResult: NodeResult | null;
  currentDisplayState: Record<string, unknown> | undefined;
  currentDisplayStateIsStale: boolean;
  profilingData: NodeProfilingData | undefined;
}

export type ActivityBranchData = ActivityBranch;
