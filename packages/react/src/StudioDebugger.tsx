import type { ReactNode } from 'react';
import { BehaviourTreeDebugger } from './BehaviourTreeDebugger';
import type { BehaviourTreeDebuggerProps } from './types';
import type { ThemeMode } from './types';
import { useStudioConnection } from './studio/useStudioConnection';
import type { StudioConnectionModel } from './studio/types';

export interface StudioDebuggerProps {
  serverUrl?: string;
  wsPath?: string;
  maxLocalTicks?: number;
  heartbeatMs?: number;
  showControls?: boolean;
  emptyState?: ReactNode;
  debuggerProps?: Omit<BehaviourTreeDebuggerProps, 'tree' | 'ticks' | 'emptyState' | 'studio'>;
  renderControls?: (
    connection: StudioConnectionModel,
    context: { themeMode: ThemeMode; onToggleTheme: () => void },
  ) => ReactNode;
}

export function StudioDebugger({
  serverUrl,
  wsPath,
  maxLocalTicks,
  heartbeatMs,
  showControls = true,
  emptyState,
  debuggerProps,
  renderControls,
}: StudioDebuggerProps) {
  const connection = useStudioConnection({
    serverUrl,
    wsPath,
    maxLocalTicks,
    heartbeatMs,
  });

  const defaultThemeMode = debuggerProps?.defaultThemeMode ?? 'dark';

  if (renderControls) {
    console.warn('[StudioDebugger] `renderControls` is deprecated and ignored in the integrated studio toolbar mode.');
  }

  return (
    <BehaviourTreeDebugger
      {...debuggerProps}
      tree={connection.tree}
      ticks={connection.ticks}
      emptyState={emptyState}
      defaultThemeMode={defaultThemeMode}
      isolateStyles={debuggerProps?.isolateStyles ?? false}
      studio={showControls ? {
        enabled: true,
        title: 'Behavior Tree Studio',
        connection,
        tickWindowLimit: maxLocalTicks ?? 5000,
      } : undefined}
    />
  );
}
