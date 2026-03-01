import type { ReactNode } from 'react';
import { BehaviourTreeDebugger } from './BehaviourTreeDebugger';
import type { BehaviourTreeDebuggerProps } from './types';
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
  debuggerProps?: Omit<BehaviourTreeDebuggerProps, 'tree' | 'ticks'>;
  renderControls?: (connection: StudioConnectionModel) => ReactNode;
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {showControls && (renderControls ? renderControls(connection) : <StudioControls connection={connection} />)}
      <div style={{ flex: 1, minHeight: 0 }}>
        {connection.tree ? (
          <BehaviourTreeDebugger
            {...debuggerProps}
            tree={connection.tree}
            ticks={connection.ticks}
          />
        ) : (
          emptyState ?? (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: 13 }}>
              Waiting for tree snapshot...
            </div>
          )
        )}
      </div>
    </div>
  );
}
