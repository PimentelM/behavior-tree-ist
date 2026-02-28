import { memo } from 'react';
import { getVisibleDisplayStateEntries } from '../../constants';

interface NodeStateDisplayProps {
  nodeFlags: number;
  state: Record<string, unknown>;
}

function NodeStateDisplayInner({ nodeFlags, state }: NodeStateDisplayProps) {
  const entries = getVisibleDisplayStateEntries(nodeFlags, state);
  if (entries.length === 0) return null;

  return (
    <div className="bt-state-display">
      <div className="bt-state-display__title">Display State</div>
      <div className="bt-state-display__entries">
        {entries.map(([key, value]) => (
          <div key={key} className="bt-state-display__entry">
            <span className="bt-state-display__key">{key}</span>
            <span className="bt-state-display__value">
              {formatValue(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export const NodeStateDisplay = memo(NodeStateDisplayInner);
