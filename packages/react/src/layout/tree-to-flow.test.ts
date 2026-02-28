import { describe, expect, it } from 'vitest';
import { NodeFlags, type SerializableNode } from '@behavior-tree-ist/core';
import { TreeIndex } from '@behavior-tree-ist/core/inspector';
import { getCapabilityBadges, getNodeVisualKind } from '../constants';
import { treeIndexToFlowElements } from './tree-to-flow';

describe('getCapabilityBadges', () => {
  it('hides the Time badge for time-based actions', () => {
    const badges = getCapabilityBadges(NodeFlags.Leaf | NodeFlags.Action | NodeFlags.Stateful | NodeFlags.TimeBased);

    expect(badges).not.toContain('Time');
  });

  it('keeps the Time badge for non-action time-based nodes', () => {
    const badges = getCapabilityBadges(NodeFlags.Decorator | NodeFlags.Stateful | NodeFlags.TimeBased);

    expect(badges).toContain('Time');
  });
});

describe('treeIndexToFlowElements', () => {
  it('renders SubTree decorators as standalone nodes', () => {
    const tree: SerializableNode = {
      id: 1,
      defaultName: 'Sequence',
      name: '',
      nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
      children: [
        {
          id: 2,
          defaultName: 'SubTree',
          name: 'Combat',
          nodeFlags: NodeFlags.Decorator | NodeFlags.SubTree,
          children: [
            {
              id: 3,
              defaultName: 'Action',
              name: 'Attack',
              nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
            },
          ],
        },
        {
          id: 4,
          defaultName: 'Timeout',
          name: '',
          nodeFlags: NodeFlags.Decorator | NodeFlags.Stateful | NodeFlags.TimeBased,
          children: [
            {
              id: 5,
              defaultName: 'Action',
              name: 'Patrol',
              nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
            },
          ],
        },
      ],
    };

    const { nodes, edges } = treeIndexToFlowElements(new TreeIndex(tree));

    expect(nodes.map((node) => node.data.nodeId)).toEqual([1, 2, 3, 5]);
    expect(edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(['1->2', '2->3', '1->5']);

    const subTreeNode = nodes.find((node) => node.data.nodeId === 2);
    expect(subTreeNode?.data.stackedDecorators).toEqual([]);

    const decoratedPatrolNode = nodes.find((node) => node.data.nodeId === 5);
    expect(decoratedPatrolNode?.data.representedNodeIds).toEqual([5, 4]);
  });

  it('maps SubTree and IfThenElse nodes to dedicated visual kinds', () => {
    expect(getNodeVisualKind(NodeFlags.Decorator | NodeFlags.SubTree, 'SubTree')).toBe('subTree');
    expect(getNodeVisualKind(NodeFlags.Composite, 'IfThenElse')).toBe('ifThenElse');
  });
});
