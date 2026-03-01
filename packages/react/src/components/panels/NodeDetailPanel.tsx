import { memo, useEffect, useState } from 'react';
import type { NodeDetailsData } from '../../types';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import { NodeHeader } from './NodeHeader';
import { NodeResultSummary } from './NodeResultSummary';
import { NodeStateDisplay } from './NodeStateDisplay';
import { NodeProfilingDisplay } from './NodeProfilingDisplay';
import { NodeHistory } from './NodeHistory';
import { RefTracesPanel } from './RefTracesPanel';

interface NodeDetailPanelProps {
  details: NodeDetailsData | null;
  refEvents: RefChangeEvent[];
  viewedTickId: number | null;
  percentilesApproximate?: boolean;
  openDetailsSignal: number;
  showRefTraces: boolean;
  onGoToTick: (tickId: number) => void;
  onFocusActorNode: (nodeId: number) => void;
}

function NodeDetailPanelInner({
  details,
  refEvents,
  viewedTickId,
  percentilesApproximate = false,
  openDetailsSignal,
  showRefTraces,
  onGoToTick,
  onFocusActorNode,
}: NodeDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'refs'>('details');

  useEffect(() => {
    setActiveTab('details');
  }, [openDetailsSignal]);

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
            Ref details
          </button>
        </div>
      )}

      <div
        className={`bt-detail-panel__content ${
          activeTab === 'details' ? 'bt-detail-panel__content--details' : 'bt-detail-panel__content--refs'
        }`}
      >
        {activeTab === 'details' ? (
          details ? (
            <>
              <NodeHeader details={details} />
              <NodeResultSummary resultSummary={details.resultSummary} />
              {details.profilingData && (
                <NodeProfilingDisplay
                  profilingData={details.profilingData}
                  percentilesApproximate={percentilesApproximate}
                />
              )}
              {details.metadata && (
                <NodeStateDisplay
                  nodeFlags={details.flags}
                  state={details.metadata}
                  isStale={false}
                  title="Metadata"
                />
              )}
              {details.currentDisplayState !== undefined && (
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
            viewedTickId={viewedTickId}
            onGoToTick={onGoToTick}
            onFocusActorNode={onFocusActorNode}
          />
        )}
      </div>
    </div>
  );
}

export const NodeDetailPanel = memo(NodeDetailPanelInner);
