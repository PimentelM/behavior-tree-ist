import { NodeFlags, NodeResult, SerializableNode, TickRecord, TickTraceEvent, hasFlag } from "../base/types";
import { TreeIndex } from "../inspector/tree-index";
import { ActivityBranch, ActivityDisplayMode, ActivitySnapshot } from "../inspector/types";

export interface ActivityProjectionOptions {
    mode?: ActivityDisplayMode;
}

export interface ActivityProjector {
    project(record: TickRecord, options?: ActivityProjectionOptions): ActivitySnapshot;
}

type BranchCandidate = {
    pathNodeIds: number[];
    lastEventIndex: number;
};

export function createActivityProjector(tree: SerializableNode): ActivityProjector {
    const index = new TreeIndex(tree);
    const preOrderPosition = new Map<number, number>();
    for (let i = 0; i < index.preOrder.length; i++) {
        preOrderPosition.set(index.preOrder[i], i);
    }

    return {
        project(record: TickRecord, options: ActivityProjectionOptions = {}): ActivitySnapshot {
            return projectActivityWithIndex(index, preOrderPosition, record, options);
        },
    };
}

export function projectActivity(
    tree: SerializableNode,
    record: TickRecord,
    options: ActivityProjectionOptions = {},
): ActivitySnapshot {
    const projector = createActivityProjector(tree);
    return projector.project(record, options);
}

export function projectActivityFromTreeIndex(
    index: TreeIndex,
    record: TickRecord,
    options: ActivityProjectionOptions = {},
): ActivitySnapshot {
    const preOrderPosition = new Map<number, number>();
    for (let i = 0; i < index.preOrder.length; i++) {
        preOrderPosition.set(index.preOrder[i], i);
    }
    return projectActivityWithIndex(index, preOrderPosition, record, options);
}

function projectActivityWithIndex(
    index: TreeIndex,
    preOrderPosition: Map<number, number>,
    record: TickRecord,
    options: ActivityProjectionOptions,
): ActivitySnapshot {
    const eventMaps = buildEventMaps(record.events);
    const mode = options.mode ?? "running";

    const rootId = index.preOrder[0];
    if (rootId === undefined || !eventMaps.lastEventByNodeId.has(rootId)) {
        return { tickId: record.tickId, timestamp: record.timestamp, branches: [] };
    }

    const candidates = collectBranchCandidates(index, rootId, eventMaps);
    const branches = candidates
        .map((candidate) => toBranch(index, candidate, eventMaps))
        .filter((branch): branch is ActivityBranch => branch !== undefined)
        .filter((branch) => includeResult(branch.tailResult, mode));

    const deduped = dedupeBranches(branches);
    deduped.sort((left, right) => {
        if (right.lastEventIndex !== left.lastEventIndex) {
            return right.lastEventIndex - left.lastEventIndex;
        }
        return (preOrderPosition.get(left.tailNodeId) ?? Number.MAX_SAFE_INTEGER)
            - (preOrderPosition.get(right.tailNodeId) ?? Number.MAX_SAFE_INTEGER);
    });

    return {
        tickId: record.tickId,
        timestamp: record.timestamp,
        branches: deduped,
    };
}

function collectBranchCandidates(
    index: TreeIndex,
    nodeId: number,
    eventMaps: {
        lastEventByNodeId: Map<number, TickTraceEvent>;
        lastEventIndexByNodeId: Map<number, number>;
    },
    pathNodeIds: number[] = [],
): BranchCandidate[] {
    const node = index.getById(nodeId);
    const event = eventMaps.lastEventByNodeId.get(nodeId);
    if (!node || !event) return [];

    const nextPath = [...pathNodeIds, nodeId];
    const activeChildren = node.childrenIds.filter((childId) => eventMaps.lastEventByNodeId.has(childId));
    if (activeChildren.length === 0) {
        return [{
            pathNodeIds: nextPath,
            lastEventIndex: eventMaps.lastEventIndexByNodeId.get(nodeId) ?? -1,
        }];
    }

    const isParallelComposite = hasFlag(node.nodeFlags, NodeFlags.Composite)
        && hasFlag(node.nodeFlags, NodeFlags.Parallel);
    if (isParallelComposite) {
        const branches: BranchCandidate[] = [];
        for (const childId of activeChildren) {
            branches.push(...collectBranchCandidates(index, childId, eventMaps, nextPath));
        }
        return branches;
    }

    let selectedChild = activeChildren[0];
    let selectedEventIndex = eventMaps.lastEventIndexByNodeId.get(selectedChild) ?? -1;
    for (let i = 1; i < activeChildren.length; i++) {
        const childId = activeChildren[i];
        const childIndex = eventMaps.lastEventIndexByNodeId.get(childId) ?? -1;
        if (childIndex >= selectedEventIndex) {
            selectedChild = childId;
            selectedEventIndex = childIndex;
        }
    }

    return collectBranchCandidates(index, selectedChild, eventMaps, nextPath);
}

function toBranch(
    index: TreeIndex,
    candidate: BranchCandidate,
    eventMaps: {
        lastEventByNodeId: Map<number, TickTraceEvent>;
        lastEventIndexByNodeId: Map<number, number>;
    },
): ActivityBranch | undefined {
    const labels: string[] = [];
    const labeledNodeIds: number[] = [];
    let tailPathEndIndex = -1;

    for (let i = 0; i < candidate.pathNodeIds.length; i++) {
        const nodeId = candidate.pathNodeIds[i];
        const node = index.getById(nodeId);
        if (!node || !node.activity) continue;
        labels.push(node.activity);
        labeledNodeIds.push(node.id);
        tailPathEndIndex = i;
    }

    if (labels.length === 0) return undefined;
    const tailNodeId = labeledNodeIds[labeledNodeIds.length - 1];
    if (tailNodeId === undefined) return undefined;

    const tailEvent = eventMaps.lastEventByNodeId.get(tailNodeId);
    if (!tailEvent) return undefined;
    const tailEventIndex = eventMaps.lastEventIndexByNodeId.get(tailNodeId) ?? candidate.lastEventIndex;
    const pathNodeIds = candidate.pathNodeIds.slice(0, tailPathEndIndex + 1);

    return {
        labels,
        nodeIds: labeledNodeIds,
        pathNodeIds,
        tailNodeId,
        tailResult: tailEvent.result,
        lastEventIndex: tailEventIndex,
    };
}

function includeResult(result: NodeResult, mode: ActivityDisplayMode): boolean {
    if (mode === "all") return true;
    if (mode === "running_or_success") {
        return result === NodeResult.Running || result === NodeResult.Succeeded;
    }
    return result === NodeResult.Running;
}

function dedupeBranches(branches: ActivityBranch[]): ActivityBranch[] {
    const dedupedByTailNodeId = new Map<number, ActivityBranch>();
    for (const branch of branches) {
        const existing = dedupedByTailNodeId.get(branch.tailNodeId);
        if (!existing || branch.lastEventIndex > existing.lastEventIndex) {
            dedupedByTailNodeId.set(branch.tailNodeId, branch);
        }
    }
    return [...dedupedByTailNodeId.values()];
}

function buildEventMaps(events: readonly TickTraceEvent[]): {
    lastEventByNodeId: Map<number, TickTraceEvent>;
    lastEventIndexByNodeId: Map<number, number>;
} {
    const lastEventByNodeId = new Map<number, TickTraceEvent>();
    const lastEventIndexByNodeId = new Map<number, number>();
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        lastEventByNodeId.set(event.nodeId, event);
        lastEventIndexByNodeId.set(event.nodeId, i);
    }
    return { lastEventByNodeId, lastEventIndexByNodeId };
}
