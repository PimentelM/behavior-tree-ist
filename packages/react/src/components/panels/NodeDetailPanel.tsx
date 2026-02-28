import { memo, useEffect, useState } from 'react';
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
  onFocusActorNode: (nodeId: number) => void;
}

function NodeDetailPanelInner({
  details,
  refEvents,
  viewedTickId,
  showRefTraces,
  onGoToTick,
  onFocusActorNode,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'refs'>('details');

  useEffect(() => {
    if (!details) return;
    setActiveTab('details');
  }, [details?.nodeId]);

  if (!details && !showRefTraces) {
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
          details ? (
            <>
              <NodeHeader details={details} />
              <NodeResultSummary resultSummary={details.resultSummary} />
              {details.currentDisplayState && (
                <NodeStateDisplay
                  nodeFlags={details.flags}
                  state={details.currentDisplayState}
                  isStale={details.currentDisplayStateIsStale}
                />
              )}
              <NodeHistory
                history={details.history}
                viewedTickId={viewedTickId}
                onGoToTick={onGoToTick}
              />
            </>
          ) : (
            <div className="bt-detail-panel__empty">
              Select a node to inspect
            </div>
          )
        ) : (
          <RefTracesPanel
            events={refEvents}
            onGoToTick={onGoToTick}
            onFocusActorNode={onFocusActorNode}
          />
        )}
      </div>
    </div>
  );
}

export const NodeDetailPanel = memo(NodeDetailPanelInner);
