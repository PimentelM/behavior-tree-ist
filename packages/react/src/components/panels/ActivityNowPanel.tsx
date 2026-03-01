import { memo } from 'react';
import type { ActivityBranchData } from '../../types';
import { getResultColor, getResultLabel } from '../../constants';

interface ActivityNowPanelProps {
  branches: readonly ActivityBranchData[];
  onSelectBranch: (branch: ActivityBranchData) => void;
  variant?: 'inline' | 'floating';
  showTitle?: boolean;
}

function ActivityNowPanelInner({
  branches,
  onSelectBranch,
  variant = 'inline',
  showTitle = true,
}: ActivityNowPanelProps) {
  return (
    <div className={`bt-activity-now bt-activity-now--${variant}`}>
      {showTitle && <div className="bt-activity-now__title">Current Activity</div>}
      {branches.length === 0 ? (
        <div className="bt-activity-now__empty">No activity for this tick</div>
      ) : (
        <div className="bt-activity-now__list">
          {branches.map((branch) => {
            const text = branch.labels.join(' > ');
            const resultColor = getResultColor(branch.tailResult);
            return (
              <button
                key={`${branch.tailNodeId}:${text}`}
                type="button"
                className="bt-activity-now__entry"
                onClick={() => onSelectBranch(branch)}
                title={text}
              >
                <span
                  className="bt-activity-now__dot"
                  style={{ backgroundColor: resultColor }}
                  aria-hidden="true"
                />
                <span className="bt-activity-now__text">{text}</span>
                <span className="bt-activity-now__result">{getResultLabel(branch.tailResult)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const ActivityNowPanel = memo(ActivityNowPanelInner);
