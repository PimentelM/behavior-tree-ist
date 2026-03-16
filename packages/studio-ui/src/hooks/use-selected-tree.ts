import { useEffect, useState, useRef } from 'react';
import type { SerializableNode } from '@bt-studio/core';
import type { StudioSelection } from '@bt-studio/react';
import { trpc } from '../trpc';

export function useSelectedTree(selection: StudioSelection | null) {
    const [tree, setTree] = useState<SerializableNode | null>(null);
    const selectionRef = useRef(selection);
    selectionRef.current = selection;

    useEffect(() => {
        if (!selection) {
            setTree(null);
            return;
        }

        const { clientId, sessionId, treeId } = selection;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
        ((trpc.trees.getById.query as any)({ clientId, sessionId, treeId }) as Promise<Record<string, unknown>>).then((result) => {
            const cur = selectionRef.current;
            if (cur?.clientId !== clientId || cur.sessionId !== sessionId || cur.treeId !== treeId) return;
            setTree((result.serializedTree as SerializableNode | null) ?? null);
        }).catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.log('[use-selected-tree] fetch error', err);
        });
    }, [selection?.clientId, selection?.sessionId, selection?.treeId]);

    return tree;
}
