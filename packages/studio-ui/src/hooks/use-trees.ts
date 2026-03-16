import { useEffect, useState, useRef } from 'react';
import type { StudioTreeInfo } from '@bt-studio/react';
import { trpc } from '../trpc';
import type { WsSubscribe } from '../use-ui-websocket';

export function useTrees(subscribe: WsSubscribe, expandedClientId: string | null, expandedSessionId: string | null) {
    const [trees, setTrees] = useState<StudioTreeInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const currentRef = useRef({ clientId: expandedClientId, sessionId: expandedSessionId });
    currentRef.current = { clientId: expandedClientId, sessionId: expandedSessionId };

    const fetchTrees = (clientId: string, sessionId: string) => {
        setLoading(true);
        trpc.trees.getBySession.query({ clientId, sessionId }).then((result) => {
            if (currentRef.current.clientId !== clientId || currentRef.current.sessionId !== sessionId) return;
            setTrees(result.map((t) => ({
                treeId: t.treeId,
                clientId: t.clientId,
                sessionId: t.sessionId,
                updatedAt: t.updatedAt,
                removedAt: t.removedAt,
            })));
            setLoading(false);
        }).catch((err) => {
            // eslint-disable-next-line no-console
            console.log('[use-trees] fetch error', err);
            if (currentRef.current.clientId === clientId && currentRef.current.sessionId === sessionId) setLoading(false);
        });
    };

    useEffect(() => {
        if (!expandedClientId || !expandedSessionId) {
            setTrees([]);
            setLoading(false);
            return;
        }
        fetchTrees(expandedClientId, expandedSessionId);
    }, [expandedClientId, expandedSessionId]);

    useEffect(() => {
        return subscribe((event) => {
            const { clientId, sessionId } = currentRef.current;
            if (!clientId || !sessionId) return;
            if (event.t === 'reconnect') {
                fetchTrees(clientId, sessionId);
                return;
            }
            if (event.t === 'catalog.changed' && event.clientId === clientId && event.sessionId === sessionId) {
                fetchTrees(clientId, sessionId);
            }
        });
    }, [subscribe]);

    return { trees, loadingTrees: loading };
}
