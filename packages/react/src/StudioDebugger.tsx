import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { BehaviourTreeDebugger } from './BehaviourTreeDebugger';
import type { BehaviourTreeDebuggerProps } from './types';
import type { ThemeMode } from './types';
import { buildTheme, themeToCSSVars } from './styles/theme';
import { StudioControls } from './studio/StudioControls';
import { useStudioConnection } from './studio/useStudioConnection';
import type { StudioConnectionModel } from './studio/types';

export interface StudioDebuggerProps {
  serverUrl?: string;
  wsPath?: string;
  maxLocalTicks?: number;
  heartbeatMs?: number;
  showControls?: boolean;
  emptyState?: ReactNode;
  debuggerProps?: Omit<BehaviourTreeDebuggerProps, 'tree' | 'ticks' | 'emptyState'>;
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
  const controlledThemeMode = debuggerProps?.themeMode;
  const defaultThemeMode = debuggerProps?.defaultThemeMode ?? 'dark';
  const [internalThemeMode, setInternalThemeMode] = useState<ThemeMode>(defaultThemeMode);
  const themeMode = controlledThemeMode ?? internalThemeMode;
  const sharedTheme = useMemo(
    () => buildTheme(themeMode, debuggerProps?.theme),
    [themeMode, debuggerProps?.theme],
  );
  const sharedCssVars = useMemo(
    () => themeToCSSVars(sharedTheme),
    [sharedTheme],
  );

  useEffect(() => {
    if (controlledThemeMode === undefined) {
      setInternalThemeMode(defaultThemeMode);
    }
  }, [controlledThemeMode, defaultThemeMode]);

  const handleThemeModeChange = useCallback((nextMode: ThemeMode) => {
    if (controlledThemeMode === undefined) {
      setInternalThemeMode(nextMode);
    }
    debuggerProps?.onThemeModeChange?.(nextMode);
  }, [controlledThemeMode, debuggerProps]);

  const handleToggleTheme = useCallback(() => {
    handleThemeModeChange(themeMode === 'dark' ? 'light' : 'dark');
  }, [handleThemeModeChange, themeMode]);

  const connection = useStudioConnection({
    serverUrl,
    wsPath,
    maxLocalTicks,
    heartbeatMs,
  });

  return (
    <div
      className={`bt-studio-shell bt-debugger--${themeMode} ${showControls ? '' : 'bt-studio-shell--no-controls'}`}
      style={{
        ...sharedCssVars as CSSProperties,
      }}
    >
      {showControls && (
        <div className="bt-studio-shell__header">
          {renderControls ? (
            renderControls(connection, {
              themeMode,
              onToggleTheme: handleToggleTheme,
            })
          ) : (
            <StudioControls
              connection={connection}
              themeMode={themeMode}
              showThemeToggle={debuggerProps?.showThemeToggle ?? true}
              onToggleTheme={handleToggleTheme}
            />
          )}
        </div>
      )}
      <div className="bt-studio-shell__debugger">
        <BehaviourTreeDebugger
          {...debuggerProps}
          tree={connection.tree}
          ticks={connection.ticks}
          emptyState={emptyState}
          theme={debuggerProps?.theme}
          themeMode={themeMode}
          defaultThemeMode={defaultThemeMode}
          onThemeModeChange={handleThemeModeChange}
          isolateStyles={debuggerProps?.isolateStyles ?? false}
        />
      </div>
    </div>
  );
}
