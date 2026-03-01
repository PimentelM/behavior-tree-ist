import { memo } from 'react';
import type { NodeDetailsData } from '../../types';
import { getDebuggerDisplayName, getFlagLabels, getResultColor, getResultLabel, getTemporalIndicatorIcon } from '../../constants';

interface NodeHeaderProps {
  details: NodeDetailsData;
}

function NodeHeaderInner({ details }: NodeHeaderProps) {
  const {
    name,
    defaultName,
    activity,
    flags,
    path,
    tags,
    currentResult,
    currentDisplayState,
  } = details;
  const displayName = getDebuggerDisplayName({
    name,
    defaultName,
    nodeFlags: flags,
    displayState: currentDisplayState,
  });
  const trimmedName = name.trim();
  const shouldShowDefaultAlias = trimmedName.length > 0
    && displayName === trimmedName
    && trimmedName !== defaultName;
  const temporalIndicator = getTemporalIndicatorIcon(flags);
  const flagLabels = getFlagLabels(flags);
  const resultColor = getResultColor(currentResult);
  const activityLabel = activity === true
    ? (trimmedName.length > 0 ? trimmedName : defaultName)
    : activity;

  return (
    <div className="bt-node-header">
      <div className="bt-node-header__name">
        {displayName}
        {temporalIndicator && (
          <span style={{ color: 'var(--bt-text-muted)', fontSize: 12, marginLeft: 6 }} title="Time/count based node">
            {temporalIndicator}
          </span>
        )}
        {shouldShowDefaultAlias && (
          <span style={{ color: 'var(--bt-text-muted)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
            ({defaultName})
          </span>
        )}
      </div>
      <div className="bt-node-header__path">{path}</div>
      {activityLabel && (
        <div className="bt-node-header__activity" title="Node activity label">
          {activityLabel}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: resultColor,
          }}
        />
        <span style={{ fontSize: 12, color: resultColor, fontWeight: 600 }}>
          {getResultLabel(currentResult)}
        </span>
      </div>
      {flagLabels.length > 0 && (
        <div className="bt-node__flags" style={{ marginTop: 6 }}>
          {flagLabels.map((fl) => (
            <span
              key={fl.label}
              className={`bt-node__flag-pill bt-node__flag-pill--${fl.category}`}
            >
              {fl.label}
            </span>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div className="bt-node-header__tags">
          {tags.map((tag) => (
            <span key={tag} className="bt-node-header__tag">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const NodeHeader = memo(NodeHeaderInner);
