import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';

export type TreeWorkerRequest =
    | {
        type: 'start';
        tickRateMs: number;
        updateRateMs: number;
    }
    | {
        type: 'stop';
    };

export type TreeWorkerEvent =
    | {
        type: 'tree';
        tree: SerializableNode;
    }
    | {
        type: 'ticks';
        ticks: TickRecord[];
    }
    | {
        type: 'error';
        message: string;
    };
