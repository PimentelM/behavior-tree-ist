import { memo, useMemo, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BTNodeComponent } from './nodes/BTNodeComponent';
import { BTEdgeComponent } from './edges/BTEdgeComponent';
import type { BTNodeData, BTEdgeData } from '../types';

interface TreeCanvasProps {
  nodes: Node<BTNodeData>[];
  edges: Edge<BTEdgeData>[];
  onNodeClick?: (nodeId: number) => void;
}

const nodeTypes: NodeTypes = {
  btNode: BTNodeComponent,
};

const edgeTypes: EdgeTypes = {
  btEdge: BTEdgeComponent,
};

function TreeCanvasInner({ nodes, edges, onNodeClick }: TreeCanvasProps) {
  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      const nodeId = parseInt(node.id, 10);
      onNodeClick?.(nodeId);
    },
    [onNodeClick],
  );

  const defaultEdgeOptions = useMemo(
    () => ({ type: 'btEdge' }),
    [],
  );

  return (
    <div className="bt-tree-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="rgba(255,255,255,0.03)" />
        <MiniMap
          nodeColor={() => 'var(--bt-border-color)'}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: 'var(--bt-bg-secondary)' }}
        />
      </ReactFlow>
    </div>
  );
}

export const TreeCanvas = memo(TreeCanvasInner);
