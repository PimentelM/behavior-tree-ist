import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { BTNodeData, BTEdgeData, LayoutDirection } from '../types';
import { NODE_WIDTH, NODE_HEIGHT_BASE, NODE_HEIGHT_WITH_STATE } from '../constants';

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
    const canShowState = hasFlag(node.data.nodeFlags, NodeFlags.Stateful)
      || hasFlag(node.data.nodeFlags, NodeFlags.Display);
    g.setNode(node.id, {
      width: NODE_WIDTH,
      height: canShowState ? NODE_HEIGHT_WITH_STATE : NODE_HEIGHT_BASE,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const canShowState = hasFlag(node.data.nodeFlags, NodeFlags.Stateful)
      || hasFlag(node.data.nodeFlags, NodeFlags.Display);
    const nodeHeight = canShowState ? NODE_HEIGHT_WITH_STATE : NODE_HEIGHT_BASE;
    return {
      ...node,
      position: {
        x: dagreNode.x - NODE_WIDTH / 2,
        y: dagreNode.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
