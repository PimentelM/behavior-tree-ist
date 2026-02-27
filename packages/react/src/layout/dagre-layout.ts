import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { BTNodeData, BTEdgeData, LayoutDirection } from '../types';
import { NODE_WIDTH, NODE_HEIGHT_BASE } from '../constants';

export function applyDagreLayout(
  nodes: Node<BTNodeData>[],
  edges: Edge<BTEdgeData>[],
  direction: LayoutDirection = 'TB',
): { nodes: Node<BTNodeData>[]; edges: Edge<BTEdgeData>[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 30,
    ranksep: 60,
    marginx: 20,
    marginy: 20,
  });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT_BASE });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - NODE_HEIGHT_BASE / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
