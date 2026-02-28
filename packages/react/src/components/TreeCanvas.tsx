import {
  memo,
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
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
import { NodeResult } from '@behavior-tree-ist/core';
import '@xyflow/react/dist/style.css';
import { BTNodeComponent } from './nodes/BTNodeComponent';
import { BTEdgeComponent } from './edges/BTEdgeComponent';
import type { BTNodeData, BTEdgeData } from '../types';

interface TreeCanvasProps {
  nodes: Node<BTNodeData>[];
  edges: Edge<BTEdgeData>[];
  onNodeClick?: (nodeId: number) => void;
  layoutVersion?: string;
  centerTreeSignal?: number;
  focusNodeId?: number | null;
  focusNodeSignal?: number;
}

const nodeTypes: NodeTypes = {
  btNode: BTNodeComponent,
};

const edgeTypes: EdgeTypes = {
  btEdge: BTEdgeComponent,
};

function getMiniMapNodeColor(node: Node<BTNodeData>): string {
  const result = node.data?.result;
  if (result === NodeResult.Succeeded) return '#22c55e';
  if (result === NodeResult.Failed) return '#ef4444';
  if (result === NodeResult.Running) return '#eab308';
  return '#64748b';
}

function TreeCanvasInner({
  nodes,
  edges,
  onNodeClick,
  layoutVersion,
  centerTreeSignal,
  focusNodeId,
  focusNodeSignal,
}: TreeCanvasProps) {
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [renderNodes, setRenderNodes] = useState<Node<BTNodeData>[]>(nodes);
  const [renderEdges, setRenderEdges] = useState<Edge<BTEdgeData>[]>(edges);
  const lastLayoutVersionRef = useRef<string | undefined>(layoutVersion);
  const lastCenterSignalRef = useRef<number | undefined>(centerTreeSignal);
  const lastFocusSignalRef = useRef<number | undefined>(focusNodeSignal);

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
    const layoutChanged = lastLayoutVersionRef.current !== layoutVersion;
    lastLayoutVersionRef.current = layoutVersion;

    if (layoutChanged) {
      setRenderNodes(nodes);
      setRenderEdges(edges);
      return;
    }

    setRenderNodes((prev) => mergeMutableNodeData(prev, nodes));
    setRenderEdges((prev) => mergeMutableEdgeData(prev, edges));
  }, [nodes, edges, layoutVersion]);

  useEffect(() => {
    if (!flowInstance || renderNodes.length === 0) return;

    const frame = requestAnimationFrame(() => {
      flowInstance.fitView({ padding: 0.2 });
    });

    return () => cancelAnimationFrame(frame);
  }, [flowInstance, layoutVersion, renderNodes.length]);

  useEffect(() => {
    if (!flowInstance || renderNodes.length === 0) return;
    if (centerTreeSignal === undefined) return;
    if (lastCenterSignalRef.current === centerTreeSignal) return;

    lastCenterSignalRef.current = centerTreeSignal;
    flowInstance.fitView({ padding: 0.2, duration: 220 });
  }, [flowInstance, renderNodes.length, centerTreeSignal]);

  useEffect(() => {
    if (!flowInstance || renderNodes.length === 0) return;
    if (focusNodeSignal === undefined || focusNodeId === null || focusNodeId === undefined) return;
    if (lastFocusSignalRef.current === focusNodeSignal) return;

    const frame = requestAnimationFrame(() => {
      const targetNode = renderNodes.find((node) => node.data.representedNodeIds.includes(focusNodeId));
      if (!targetNode) return;

      const nodeWidth = targetNode.measured?.width ?? targetNode.width ?? 0;
      const nodeHeight = targetNode.measured?.height ?? targetNode.height ?? 0;
      const centerX = targetNode.position.x + (nodeWidth / 2);
      const centerY = targetNode.position.y + (nodeHeight / 2);
      const currentZoom = flowInstance.getZoom();

      flowInstance.setCenter(centerX, centerY, {
        zoom: Math.min(Math.max(currentZoom, 0.9), 1.35),
        duration: 260,
      });
      lastFocusSignalRef.current = focusNodeSignal;
    });

    return () => cancelAnimationFrame(frame);
  }, [flowInstance, renderNodes, focusNodeId, focusNodeSignal]);

  return (
    <div className="bt-tree-canvas">
      <ReactFlow
        nodes={renderNodes}
        edges={renderEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        onInit={setFlowInstance}
        nodesDraggable={false}
        panOnDrag
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={20} size={1} color="var(--bt-grid-color)" />
        <MiniMap
          nodeColor={getMiniMapNodeColor}
          maskColor="rgba(0,0,0,0.08)"
          nodeStrokeWidth={2}
          zoomable
          pannable
          style={{ background: 'var(--bt-bg-secondary)' }}
        />
      </ReactFlow>
    </div>
  );
}

function mergeMutableNodeData(
  previousNodes: Node<BTNodeData>[],
  nextNodes: Node<BTNodeData>[],
): Node<BTNodeData>[] {
  if (previousNodes.length !== nextNodes.length) return nextNodes;

  const nextById = new Map(nextNodes.map((node) => [node.id, node]));
  if (nextById.size !== nextNodes.length) return nextNodes;

  const merged: Node<BTNodeData>[] = [];
  let changed = false;

  for (const previousNode of previousNodes) {
    const nextNode = nextById.get(previousNode.id);
    if (!nextNode) return nextNodes;

    const nextResult = nextNode.data.result;
    const nextDisplayState = nextNode.data.displayState;
    const nextDisplayStateIsStale = nextNode.data.displayStateIsStale;
    const nextIsSelected = nextNode.data.isSelected;
    const nextSelectedNodeId = nextNode.data.selectedNodeId;
    const nextRefEvents = nextNode.data.refEvents;
    const nextStackedDecorators = nextNode.data.stackedDecorators;
    const nextSelected = nextNode.selected;

    const sameMutableData = previousNode.data.result === nextResult
      && shallowEqualRecord(previousNode.data.displayState, nextDisplayState)
      && previousNode.data.displayStateIsStale === nextDisplayStateIsStale
      && previousNode.data.isSelected === nextIsSelected
      && previousNode.data.selectedNodeId === nextSelectedNodeId
      && shallowEqualRefEvents(previousNode.data.refEvents, nextRefEvents)
      && shallowEqualDecorators(previousNode.data.stackedDecorators, nextStackedDecorators)
      && previousNode.selected === nextSelected;

    if (sameMutableData) {
      merged.push(previousNode);
      continue;
    }

    changed = true;
    merged.push({
      ...previousNode,
      data: {
        ...previousNode.data,
        result: nextResult,
        displayState: nextDisplayState,
        displayStateIsStale: nextDisplayStateIsStale,
        isSelected: nextIsSelected,
        selectedNodeId: nextSelectedNodeId,
        refEvents: nextRefEvents,
        stackedDecorators: nextStackedDecorators,
      },
      selected: nextSelected,
    });
  }

  return changed ? merged : previousNodes;
}

function mergeMutableEdgeData(
  previousEdges: Edge<BTEdgeData>[],
  nextEdges: Edge<BTEdgeData>[],
): Edge<BTEdgeData>[] {
  if (previousEdges.length !== nextEdges.length) return nextEdges;

  const nextById = new Map(nextEdges.map((edge) => [edge.id, edge]));
  if (nextById.size !== nextEdges.length) return nextEdges;

  const merged: Edge<BTEdgeData>[] = [];
  let changed = false;

  for (const previousEdge of previousEdges) {
    const nextEdge = nextById.get(previousEdge.id);
    if (!nextEdge) return nextEdges;

    const nextChildResult = nextEdge.data?.childResult ?? null;
    const sameMutableData = previousEdge.data?.childResult === nextChildResult
      && previousEdge.animated === nextEdge.animated;

    if (sameMutableData) {
      merged.push(previousEdge);
      continue;
    }

    changed = true;
    merged.push({
      ...previousEdge,
      data: {
        ...(previousEdge.data ?? {}),
        childResult: nextChildResult,
      } as BTEdgeData,
      animated: nextEdge.animated,
    });
  }

  return changed ? merged : previousEdges;
}

function shallowEqualRecord(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!Object.is(left[key], right[key])) return false;
  }

  return true;
}

function shallowEqualRefEvents(left: BTNodeData['refEvents'], right: BTNodeData['refEvents']): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i++) {
    if (left[i].refName !== right[i].refName) return false;
    if (!Object.is(left[i].newValue, right[i].newValue)) return false;
    if (left[i].isAsync !== right[i].isAsync) return false;
  }

  return true;
}

function shallowEqualDecorators(
  left: BTNodeData['stackedDecorators'],
  right: BTNodeData['stackedDecorators'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i++) {
    if (left[i].nodeId !== right[i].nodeId) return false;
    if (left[i].result !== right[i].result) return false;
    if (left[i].displayStateIsStale !== right[i].displayStateIsStale) return false;
    if (!shallowEqualRecord(left[i].displayState, right[i].displayState)) return false;
    if (!shallowEqualRefEvents(left[i].refEvents, right[i].refEvents)) return false;
  }

  return true;
}

export const TreeCanvas = memo(TreeCanvasInner);
