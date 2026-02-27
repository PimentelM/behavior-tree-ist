import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { BTNodeData } from '../../types';
import { getResultColor, getFlagLabels } from '../../constants';

type BTFlowNode = Node<BTNodeData, 'btNode'>;

function BTNodeComponentInner({ data }: NodeProps<BTFlowNode>) {
  const { name, defaultName, nodeId, nodeFlags, result, displayState, isSelected } = data;
  const displayName = name || defaultName;
  const accentColor = getResultColor(result);
  const flagLabels = getFlagLabels(nodeFlags);

  const stateEntries = displayState
    ? Object.entries(displayState)
    : [];
  const hasState = stateEntries.length > 0;

  return (
    <div className={`bt-node ${isSelected ? 'bt-node--selected' : ''} ${hasState ? 'bt-node--with-state' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div
        className="bt-node__accent"
        style={{ backgroundColor: accentColor }}
      />
      <div className="bt-node__body">
        <div className="bt-node__header">
          <span className="bt-node__name" title={displayName}>
            {displayName}
          </span>
          <span className="bt-node__id-badge">#{nodeId}</span>
        </div>
        <div className="bt-node__flags">
          {flagLabels.map((fl) => (
            <span
              key={fl.label}
              className={`bt-node__flag-pill bt-node__flag-pill--${fl.category}`}
            >
              {fl.label}
            </span>
          ))}
        </div>
        {hasState && (
          <div className="bt-node__display-state">
            {stateEntries.map(([key, value]) => (
              <div key={key} className="bt-node__state-entry">
                <span className="bt-node__state-key">{key}</span>
                <span className="bt-node__state-value">
                  {formatValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export const BTNodeComponent = memo(BTNodeComponentInner);
