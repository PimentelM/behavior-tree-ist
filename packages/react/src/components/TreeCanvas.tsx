import {
  memo,
  useMemo,
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  type ReactFlowInstance,
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
  layoutVersion?: string;
}

const nodeTypes: NodeTypes = {
  btNode: BTNodeComponent,
};

const edgeTypes: EdgeTypes = {
  btEdge: BTEdgeComponent,
};

function TreeCanvasInner({ nodes, edges, onNodeClick, layoutVersion }: TreeCanvasProps) {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);

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

  useEffect(() => {
    if (!flowInstance || nodes.length === 0) return;

    const frame = requestAnimationFrame(() => {
      flowInstance.fitView({ padding: 0.2 });
    });

    return () => cancelAnimationFrame(frame);
  }, [flowInstance, layoutVersion, nodes.length]);

  return (
    <div className="bt-tree-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        onInit={setFlowInstance}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
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
