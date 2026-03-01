import { memo } from 'react';
import type { ActivityBranchData } from '../../types';
import { getResultColor, getResultLabel } from '../../constants';

interface ActivityNowPanelProps {
  branches: readonly ActivityBranchData[];
  onSelectBranch: (branch: ActivityBranchData) => void;
  selectedTailNodeId?: number | null;
  getBranchText?: (branch: ActivityBranchData) => string;
  variant?: 'inline' | 'floating';
  showTitle?: boolean;
}

function ActivityNowPanelInner({
  branches,
  onSelectBranch,
  selectedTailNodeId = null,
  getBranchText,
  variant = 'inline',
  showTitle = true,
}: ActivityNowPanelProps) {
  const resolveBranchText = (branch: ActivityBranchData): string => {
    if (getBranchText) return getBranchText(branch);
    return branch.labels.join(' > ');
  };

  return (
    <div className={`bt-activity-now bt-activity-now--${variant}`}>
      {showTitle && <div className="bt-activity-now__title">Current Activity</div>}
      {branches.length === 0 ? (
        <div className="bt-activity-now__empty">No activity for this tick</div>
      ) : (
        <div className="bt-activity-now__list">
          {branches.map((branch) => {
            const text = resolveBranchText(branch);
            const resultColor = getResultColor(branch.tailResult);
            const isSelected = selectedTailNodeId === branch.tailNodeId;
            return (
              <button
                key={branch.tailNodeId}
                type="button"
                className={`bt-activity-now__entry ${isSelected ? 'bt-activity-now__entry--selected' : ''}`}
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
