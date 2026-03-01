import { memo } from 'react';
import { BaseEdge, getSmoothStepPath } from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import type { BTEdgeData } from '../../types';
import { NodeResult } from '@behavior-tree-ist/core';

type BTFlowEdge = Edge<BTEdgeData, 'btEdge'>;

function BTEdgeComponentInner({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<BTFlowEdge>) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const childResult = data?.childResult ?? null;
  const isOnActivityPathEdge = data?.isOnActivityPathEdge ?? false;

  let className = 'bt-edge-path bt-edge-path--idle';
  if (childResult === NodeResult.Succeeded) className = 'bt-edge-path bt-edge-path--succeeded';
  else if (childResult === NodeResult.Failed) className = 'bt-edge-path bt-edge-path--failed';
  else if (childResult === NodeResult.Running) className = 'bt-edge-path bt-edge-path--running';
  if (isOnActivityPathEdge) className += ' bt-edge-path--activity-path';

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      className={className}
    />
  );
}

export const BTEdgeComponent = memo(BTEdgeComponentInner);
