import { memo } from 'react';
import type { NodeDetailsData } from '../../types';
import { getFlagLabels, getResultColor, getResultLabel } from '../../constants';

interface NodeHeaderProps {
  details: NodeDetailsData;
}

function NodeHeaderInner({ details }: NodeHeaderProps) {
  const { name, defaultName, flags, path, tags, currentResult } = details;
  const displayName = name || defaultName;
  const flagLabels = getFlagLabels(flags);
  const resultColor = getResultColor(currentResult);

  return (
    <div className="bt-node-header">
      <div className="bt-node-header__name">
        {displayName}
        {displayName !== defaultName && (
          <span style={{ color: 'var(--bt-text-muted)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
            ({defaultName})
          </span>
        )}
      </div>
      <div className="bt-node-header__path">{path}</div>
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
