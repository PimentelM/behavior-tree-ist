import { NodeResult, NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { ThemeOverrides } from './types';

export const DEFAULT_THEME: Required<ThemeOverrides> = {
  colorSucceeded: '#4ade80',
  colorFailed: '#f87171',
  colorRunning: '#60a5fa',
  colorIdle: '#6b7280',
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16213e',
  bgTertiary: '#0f3460',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  borderColor: '#334155',
  accentColor: '#818cf8',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
};

export const RESULT_COLORS: Record<string, string> = {
  [NodeResult.Succeeded]: DEFAULT_THEME.colorSucceeded,
  [NodeResult.Failed]: DEFAULT_THEME.colorFailed,
  [NodeResult.Running]: DEFAULT_THEME.colorRunning,
};

export function getResultColor(result: NodeResult | null | undefined, theme: Required<ThemeOverrides> = DEFAULT_THEME): string {
  if (result === null || result === undefined) return theme.colorIdle;
  switch (result) {
    case NodeResult.Succeeded: return theme.colorSucceeded;
    case NodeResult.Failed: return theme.colorFailed;
    case NodeResult.Running: return theme.colorRunning;
    default: return theme.colorIdle;
  }
}

export function getResultLabel(result: NodeResult | null | undefined): string {
  if (result === null || result === undefined) return 'Idle';
  return result;
}

interface FlagLabel {
  label: string;
  category: 'primary' | 'secondary';
}

const FLAG_DEFINITIONS: Array<{ flag: number; label: string; category: 'primary' | 'secondary' }> = [
  { flag: NodeFlags.Composite, label: 'Composite', category: 'primary' },
  { flag: NodeFlags.Decorator, label: 'Decorator', category: 'primary' },
  { flag: NodeFlags.Leaf, label: 'Leaf', category: 'primary' },
  { flag: NodeFlags.Action, label: 'Action', category: 'secondary' },
  { flag: NodeFlags.Condition, label: 'Condition', category: 'secondary' },
  { flag: NodeFlags.Sequence, label: 'Sequence', category: 'secondary' },
  { flag: NodeFlags.Selector, label: 'Selector', category: 'secondary' },
  { flag: NodeFlags.Parallel, label: 'Parallel', category: 'secondary' },
  { flag: NodeFlags.Memory, label: 'Memory', category: 'secondary' },
  { flag: NodeFlags.Stateful, label: 'Stateful', category: 'secondary' },
  { flag: NodeFlags.Utility, label: 'Utility', category: 'secondary' },
  { flag: NodeFlags.Repeating, label: 'Repeating', category: 'secondary' },
  { flag: NodeFlags.ResultTransformer, label: 'Transformer', category: 'secondary' },
  { flag: NodeFlags.Guard, label: 'Guard', category: 'secondary' },
  { flag: NodeFlags.Lifecycle, label: 'Lifecycle', category: 'secondary' },
  { flag: NodeFlags.Display, label: 'Display', category: 'secondary' },
];

export function getFlagLabels(nodeFlags: number): FlagLabel[] {
  const labels: FlagLabel[] = [];
  for (const def of FLAG_DEFINITIONS) {
    if (hasFlag(nodeFlags, def.flag)) {
      labels.push({ label: def.label, category: def.category });
    }
  }
  return labels;
}

export function getPrimaryCategoryLabel(nodeFlags: number): string {
  if (hasFlag(nodeFlags, NodeFlags.Composite)) return 'Composite';
  if (hasFlag(nodeFlags, NodeFlags.Decorator)) return 'Decorator';
  if (hasFlag(nodeFlags, NodeFlags.Leaf)) return 'Leaf';
  return 'Node';
}

export const NODE_WIDTH = 220;
export const NODE_HEIGHT_BASE = 60;
export const NODE_HEIGHT_WITH_STATE = 100;
export const EDGE_ANIMATED_STROKE_DASHARRAY = '5 5';
