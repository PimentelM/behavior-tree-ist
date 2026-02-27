import { memo } from 'react';
import { NodeResult } from '@behavior-tree-ist/core';
import { getResultColor } from '../../constants';

interface NodeResultSummaryProps {
  resultSummary: Map<string, number>;
}

const RESULT_ORDER = [NodeResult.Succeeded, NodeResult.Failed, NodeResult.Running] as const;

function NodeResultSummaryInner({ resultSummary }: NodeResultSummaryProps) {
  let total = 0;
  for (const count of resultSummary.values()) {
    total += count;
  }

  if (total === 0) return null;

  return (
    <div className="bt-result-summary">
      <div className="bt-result-summary__title">Result Distribution</div>
      <div className="bt-result-summary__bars">
        {RESULT_ORDER.map((result) => {
          const count = resultSummary.get(result) ?? 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <div key={result} className="bt-result-summary__bar-row">
              <span className="bt-result-summary__bar-label">{result}</span>
              <div className="bt-result-summary__bar-track">
                <div
                  className="bt-result-summary__bar-fill"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getResultColor(result),
                  }}
                />
              </div>
              <span className="bt-result-summary__bar-count">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const NodeResultSummary = memo(NodeResultSummaryInner);
