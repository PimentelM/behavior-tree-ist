import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { BTNodeData, NodeVisualKind } from '../../types';
import { getDebuggerDisplayName, getResultColor, getTemporalIndicatorIcon } from '../../constants';

type BTFlowNode = Node<BTNodeData, 'btNode'>;

function BTNodeComponentInner({ data }: NodeProps<BTFlowNode>) {
  const {
    name,
    defaultName,
    nodeFlags,
    result,
    displayState,
    displayStateIsStale,
    isSelected,
    visualKind,
    stackedDecorators,
    lifecycleDecorators,
    capabilityBadges,
    refEvents,
    selectedNodeId,
    onSelectNode,
  } = data;
  const displayName = getDebuggerDisplayName({
    name,
    defaultName,
    nodeFlags,
    displayState,
  });
  const temporalIndicator = getTemporalIndicatorIcon(nodeFlags);
  const accentColor = getResultColor(result);
  const lifecycleDecoratorIds = lifecycleDecorators.map((entry) => entry.nodeId);
  const lifecycleDecoratorNames = lifecycleDecorators.map((entry) => getDebuggerDisplayName({
    name: entry.name,
    defaultName: entry.defaultName,
    nodeFlags: entry.nodeFlags,
  }));

  const stateEntries = displayState
    ? Object.entries(displayState)
    : [];
  const hasState = stateEntries.length > 0;
  const hasRefEvents = refEvents.length > 0;

  return (
    <div className={`bt-node bt-node--${visualKind} ${isSelected ? 'bt-node--selected' : ''} ${hasState ? 'bt-node--with-state' : ''}`}>
      <Handle type="target" position={Position.Top} />
      <div
        className="bt-node__accent"
        style={{ backgroundColor: accentColor }}
      />
      <div className="bt-node__body">
        {stackedDecorators.length > 0 && (
          <div className="bt-node__decorator-stack">
            {stackedDecorators.map((decorator) => {
              const decoratorState = decorator.displayState
                ? Object.entries(decorator.displayState)
                : [];
              const decoratorColor = getResultColor(decorator.result);
              return (
                <div key={decorator.nodeId} className="bt-node__decorator-entry">
                  <button
                    className={`bt-node__decorator-row ${selectedNodeId === decorator.nodeId ? 'bt-node__decorator-row--selected' : ''} ${decorator.displayStateIsStale ? 'bt-node__decorator-row--stale' : ''}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectNode?.(decorator.nodeId);
                    }}
                  >
                    <span className="bt-node__decorator-dot" style={{ backgroundColor: decoratorColor }} />
                    <span className="bt-node__decorator-name">{
                      getDebuggerDisplayName({
                        name: decorator.name,
                        defaultName: decorator.defaultName,
                        nodeFlags: decorator.nodeFlags,
                        displayState: decorator.displayState,
                      })
                    }</span>
                    {getTemporalIndicatorIcon(decorator.nodeFlags) && (
                      <span className="bt-node__temporal-indicator" title="Time/count based node">
                        {getTemporalIndicatorIcon(decorator.nodeFlags)}
                      </span>
                    )}
                    {decoratorState.length > 0 && (
                      <span className="bt-node__decorator-state">{decoratorState.length} state</span>
                    )}
                  </button>
                  {decorator.refEvents.length > 0 && (
                    <div className="bt-node__decorator-refs">
                      {decorator.refEvents.map((event, index) => (
                        <div key={`${event.refName ?? 'ref'}-${index}`} className="bt-node__ref-entry">
                          <span className="bt-node__ref-name">{event.refName ?? '(unnamed)'}</span>
                          <span className="bt-node__ref-value">{formatValue(event.newValue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="bt-node__header">
          <span className={`bt-node__glyph bt-node__glyph--${visualKind}`} aria-hidden="true">
            <NodeGlyph kind={visualKind} />
          </span>
          <span className="bt-node__name" title={displayName}>
            {displayName}
          </span>
          {temporalIndicator && (
            <span className="bt-node__temporal-indicator" title="Time/count based node">
              {temporalIndicator}
            </span>
          )}
          {lifecycleDecoratorIds.length > 0 && (
            <span className="bt-node__lifecycle-pill" title="Lifecycle decorator hooks">
              <button
                className="bt-node__lifecycle-button"
                type="button"
                title={lifecycleDecoratorNames.join('\n')}
                onClick={(event) => {
                  event.stopPropagation();
                  const selectedIndex = lifecycleDecoratorIds.indexOf(selectedNodeId ?? -1);
                  const nextIndex = selectedIndex >= 0
                    ? (selectedIndex + 1) % lifecycleDecoratorIds.length
                    : 0;
                  const lifecycleNodeId = lifecycleDecoratorIds[nextIndex];
                  if (lifecycleNodeId !== undefined) {
                    onSelectNode?.(lifecycleNodeId);
                  }
                }}
              >
                {'\u26A1'}{lifecycleDecoratorIds.length}
              </button>
            </span>
          )}
        </div>
        {capabilityBadges.length > 0 && (
          <div className="bt-node__badges">
            {capabilityBadges.map((badge) => (
              <span key={badge} className="bt-node__badge">{badge}</span>
            ))}
          </div>
        )}
        {hasState && (
          <div className={`bt-node__display-state ${displayStateIsStale ? 'bt-node__display-state--stale' : ''}`}>
            {displayStateIsStale && <div className="bt-node__state-meta" title="Showing last known state" />}
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
        {hasRefEvents && (
          <div className="bt-node__ref-events">
            {refEvents.map((event, index) => (
              <div key={`${event.refName ?? 'ref'}-${index}`} className="bt-node__ref-entry">
                <span className="bt-node__ref-name">{event.refName ?? '(unnamed)'}</span>
                <span className="bt-node__ref-value">{formatValue(event.newValue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function NodeGlyph({ kind }: { kind: NodeVisualKind }) {
  switch (kind) {
    case 'sequence':
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <path d="M2.5 8h9" />
          <path d="m9.5 5 4 3-4 3" />
        </svg>
      );
    case 'fallback':
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <path d="M5.6 6.2a2.4 2.4 0 1 1 4 1.8c-.9.6-1.4 1.1-1.4 2" />
          <circle cx="8" cy="12.3" r="0.8" />
        </svg>
      );
    case 'parallel':
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <path d="M2.5 4h6" />
          <path d="m7.5 2 3 2-3 2" />
          <path d="M2.5 8h6" />
          <path d="m7.5 6 3 2-3 2" />
          <path d="M2.5 12h6" />
          <path d="m7.5 10 3 2-3 2" />
        </svg>
      );
    case 'condition':
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <path d="M8 2.5 13 8l-5 5.5L3 8z" />
          <path d="m6.2 8 1.4 1.5L10 7" />
        </svg>
      );
    case 'action':
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <path d="M5 3.5h6v9H5z" />
          <path d="M6.5 6h3" />
          <path d="M6.5 8h3" />
          <path d="M6.5 10h2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className="bt-node__glyph-icon">
          <circle cx="8" cy="8" r="3" />
        </svg>
      );
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function areNodePropsEqual(prev: NodeProps<BTFlowNode>, next: NodeProps<BTFlowNode>): boolean {
  return prev.id === next.id
    && prev.selected === next.selected
    && prev.data.result === next.data.result
    && prev.data.isSelected === next.data.isSelected
    && shallowEqualRecord(prev.data.displayState, next.data.displayState)
    && prev.data.displayStateIsStale === next.data.displayStateIsStale
    && prev.data.name === next.data.name
    && prev.data.defaultName === next.data.defaultName
    && prev.data.nodeFlags === next.data.nodeFlags
    && prev.data.nodeId === next.data.nodeId
    && prev.data.selectedNodeId === next.data.selectedNodeId
    && shallowEqualStringArray(prev.data.capabilityBadges, next.data.capabilityBadges)
    && prev.data.lifecycleDecorators.length === next.data.lifecycleDecorators.length
    && shallowEqualDecorators(prev.data.stackedDecorators, next.data.stackedDecorators)
    && shallowEqualRefEvents(prev.data.refEvents, next.data.refEvents);
}

function shallowEqualStringArray(left: string[], right: string[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function shallowEqualRefEvents(left: BTNodeData['refEvents'], right: BTNodeData['refEvents']): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i].refName !== right[i].refName) return false;
    if (!Object.is(left[i].newValue, right[i].newValue)) return false;
    if (left[i].isAsync !== right[i].isAsync) return false;
  }
  return true;
}

function shallowEqualDecorators(
  left: BTNodeData['stackedDecorators'],
  right: BTNodeData['stackedDecorators'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i].nodeId !== right[i].nodeId) return false;
    if (left[i].result !== right[i].result) return false;
    if (left[i].displayStateIsStale !== right[i].displayStateIsStale) return false;
    if (!shallowEqualRecord(left[i].displayState, right[i].displayState)) return false;
    if (!shallowEqualRefEvents(left[i].refEvents, right[i].refEvents)) return false;
  }
  return true;
}

function shallowEqualRecord(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!Object.is(left[key], right[key])) return false;
  }

  return true;
}

export const BTNodeComponent = memo(BTNodeComponentInner, areNodePropsEqual);
