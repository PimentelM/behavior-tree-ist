import {
    NodeResult,
    SerializableNode,
    StudioCommandType,
    TickRecord,
} from '@bt-studio/core';
import type { TreeRecord } from '../../domain/records';

export interface TreeScopeStub {
    clientId: string;
    sessionId: string;
    treeId: string;
}

export interface CommandInputStub extends TreeScopeStub {
    command: StudioCommandType;
}

export interface TickQueryInputStub extends TreeScopeStub {
    afterTickId: number;
    limit: number;
}

const defaultTreeScope: TreeScopeStub = {
    clientId: 'test-client',
    sessionId: 'test-session',
    treeId: 'test-tree',
};

export function createTreeScopeStub(overrides: Partial<TreeScopeStub> = {}): TreeScopeStub {
    return {
        ...defaultTreeScope,
        ...overrides,
    };
}

export function createClientInputStub(
    overrides: Partial<Pick<TreeScopeStub, 'clientId'>> = {},
): Pick<TreeScopeStub, 'clientId'> {
    return {
        clientId: defaultTreeScope.clientId,
        ...overrides,
    };
}

export function createSessionInputStub(
    overrides: Partial<Pick<TreeScopeStub, 'clientId' | 'sessionId'>> = {},
): Pick<TreeScopeStub, 'clientId' | 'sessionId'> {
    return {
        clientId: defaultTreeScope.clientId,
        sessionId: defaultTreeScope.sessionId,
        ...overrides,
    };
}

export function createTreeInputStub(
    overrides: Partial<TreeScopeStub> = {},
): TreeScopeStub {
    return {
        ...defaultTreeScope,
        ...overrides,
    };
}

export function createTickQueryInputStub(
    overrides: Partial<TickQueryInputStub> = {},
): TickQueryInputStub {
    return {
        ...defaultTreeScope,
        afterTickId: 0,
        limit: 100,
        ...overrides,
    };
}

export function createCommandInputStub(
    overrides: Partial<CommandInputStub> = {},
): CommandInputStub {
    return {
        ...defaultTreeScope,
        command: StudioCommandType.GetTreeStatuses,
        ...overrides,
    };
}

export function createSerializableNodeStub(
    overrides: Partial<SerializableNode> = {},
): SerializableNode {
    return {
        id: 1,
        nodeFlags: 1,
        defaultName: 'StubAction',
        name: 'StubAction',
        children: [],
        ...overrides,
    };
}

export function createTickRecordStub(
    overrides: Partial<TickRecord> = {},
): TickRecord {
    return {
        tickId: 1,
        timestamp: Date.now(),
        events: [
            {
                nodeId: 1,
                result: NodeResult.Succeeded,
            },
        ],
        refEvents: [],
        ...overrides,
    };
}

export function createTreeRecordStub(
    overrides: Partial<TreeRecord> = {},
): TreeRecord {
    const scope = createTreeScopeStub();
    return {
        clientId: scope.clientId,
        sessionId: scope.sessionId,
        treeId: scope.treeId,
        serializedTree: createSerializableNodeStub(),
        updatedAt: Date.now(),
        ...overrides,
    };
}
