import { memo, useState } from 'react';
import type { NodeDetailsData } from '../../types';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import { NodeHeader } from './NodeHeader';
import { NodeResultSummary } from './NodeResultSummary';
import { NodeStateDisplay } from './NodeStateDisplay';
import { NodeHistory } from './NodeHistory';
import { RefTracesPanel } from './RefTracesPanel';

interface NodeDetailPanelProps {
  details: NodeDetailsData | null;
  refEvents: RefChangeEvent[];
  viewedTickId: number | null;
  showRefTraces: boolean;
  onGoToTick: (tickId: number) => void;
}

function NodeDetailPanelInner({
  details,
  refEvents,
  viewedTickId,
  showRefTraces,
  onGoToTick,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'refs'>('details');

  if (!details) {
    return (
      <div className="bt-detail-panel">
        <div className="bt-detail-panel__empty">
          Select a node to inspect
        </div>
      </div>
    );
  }

  return (
    <div className="bt-detail-panel">
      {showRefTraces && (
        <div className="bt-detail-panel__tabs">
          <button
            className={`bt-detail-panel__tab ${
              activeTab === 'details' ? 'bt-detail-panel__tab--active' : ''
            }`}
            onClick={() => setActiveTab('details')}
          >
            Node Details
          </button>
          <button
            className={`bt-detail-panel__tab ${
              activeTab === 'refs' ? 'bt-detail-panel__tab--active' : ''
            }`}
            onClick={() => setActiveTab('refs')}
          >
            Ref Traces
          </button>
        </div>
      )}

      <div className="bt-detail-panel__content">
        {activeTab === 'details' ? (
          <>
            <NodeHeader details={details} />
            <NodeResultSummary resultSummary={details.resultSummary} />
            {details.currentDisplayState && (
              <NodeStateDisplay nodeFlags={details.flags} state={details.currentDisplayState} />
            )}
            <NodeHistory
              history={details.history}
              viewedTickId={viewedTickId}
              onGoToTick={onGoToTick}
            />
          </>
        ) : (
          <RefTracesPanel events={refEvents} onGoToTick={onGoToTick} />
        )}
      </div>
    </div>
  );
}

export const NodeDetailPanel = memo(NodeDetailPanelInner);
