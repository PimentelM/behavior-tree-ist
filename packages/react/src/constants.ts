import { NodeResult, NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { ThemeOverrides, NodeVisualKind } from './types';

export const DARK_THEME: Required<ThemeOverrides> = {
  colorSucceeded: '#22c55e',
  colorFailed: '#f14c4c',
  colorRunning: '#cca700',
  colorIdle: '#8b8b8b',
  bgPrimary: '#1e1e1e',
  bgSecondary: '#252526',
  bgTertiary: '#2d2d30',
  textPrimary: '#cccccc',
  textSecondary: '#b3b3b3',
  textMuted: '#8b8b8b',
  borderColor: '#3c3c3c',
  accentColor: '#3794ff',
  fontFamily: '"Geist", "Avenir Next", "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
};

export const LIGHT_THEME: Required<ThemeOverrides> = {
  colorSucceeded: '#16a34a',
  colorFailed: '#dc2626',
  colorRunning: '#d97706',
  colorIdle: '#71717a',
  bgPrimary: '#ffffff',
  bgSecondary: '#fafafa',
  bgTertiary: '#f4f4f5',
  textPrimary: '#09090b',
  textSecondary: '#3f3f46',
  textMuted: '#71717a',
  borderColor: '#e4e4e7',
  accentColor: '#18181b',
  fontFamily: '"Geist", "Avenir Next", "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
};

export const DEFAULT_THEME: Required<ThemeOverrides> = DARK_THEME;

export const RESULT_COLORS: Record<string, string> = {
  [NodeResult.Succeeded]: DEFAULT_THEME.colorSucceeded,
  [NodeResult.Failed]: DEFAULT_THEME.colorFailed,
  [NodeResult.Running]: DEFAULT_THEME.colorRunning,
};

export function getResultColor(result: NodeResult | null | undefined, theme?: Required<ThemeOverrides>): string {
  const resolved = theme;
  if (result === null || result === undefined) return resolved ? resolved.colorIdle : 'var(--bt-color-idle)';
  switch (result) {
    case NodeResult.Succeeded: return resolved ? resolved.colorSucceeded : 'var(--bt-color-succeeded)';
    case NodeResult.Failed: return resolved ? resolved.colorFailed : 'var(--bt-color-failed)';
    case NodeResult.Running: return resolved ? resolved.colorRunning : 'var(--bt-color-running)';
    default: return resolved ? resolved.colorIdle : 'var(--bt-color-idle)';
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
  { flag: NodeFlags.Async, label: 'Async', category: 'secondary' },
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

export function getNodeVisualKind(nodeFlags: number): NodeVisualKind {
  if (hasFlag(nodeFlags, NodeFlags.Sequence)) return 'sequence';
  if (hasFlag(nodeFlags, NodeFlags.Selector)) return 'selector';
  if (hasFlag(nodeFlags, NodeFlags.Parallel)) return 'parallel';
  if (hasFlag(nodeFlags, NodeFlags.Action)) return 'action';
  if (hasFlag(nodeFlags, NodeFlags.Condition)) return 'condition';
  return 'node';
}

const CAPABILITY_BADGE_DEFS: Array<{ flag: number; label: string }> = [
  { flag: NodeFlags.Async, label: 'Async' },
  { flag: NodeFlags.Memory, label: 'Memory' },
  { flag: NodeFlags.Utility, label: 'Utility' },
  { flag: NodeFlags.Stateful, label: 'Stateful' },
  { flag: NodeFlags.Repeating, label: 'Repeat' },
  { flag: NodeFlags.Guard, label: 'Guard' },
  { flag: NodeFlags.ResultTransformer, label: 'Transform' },
];

export function getCapabilityBadges(nodeFlags: number): string[] {
  const badges: string[] = [];
  for (const entry of CAPABILITY_BADGE_DEFS) {
    if (hasFlag(nodeFlags, entry.flag)) badges.push(entry.label);
  }
  return badges;
}

export const NODE_WIDTH = 220;
export const NODE_HEIGHT_BASE = 60;
export const NODE_HEIGHT_WITH_STATE = 100;
export const EDGE_ANIMATED_STROKE_DASHARRAY = '5 5';
