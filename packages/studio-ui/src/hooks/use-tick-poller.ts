import { useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@behavior-tree-ist/core';
import type { StudioSelection } from '@behavior-tree-ist/react';
import { trpc } from '../trpc';

export function useTickPoller(
    selection: StudioSelection | null,
    pollRateMs: number,
    ringBufferSize: number,
    streaming: boolean,
) {
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const afterTickIdRef = useRef(0);
    const selectionRef = useRef(selection);
    const historicalLoadedRef = useRef(false);

    // Reset on selection change
    useEffect(() => {
        selectionRef.current = selection;
        afterTickIdRef.current = 0;
        historicalLoadedRef.current = false;
        setTicks([]);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId]);

    const fetchTicks = () => {
        const sel = selectionRef.current;
        if (!sel) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (trpc.ticks.query.query as any)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            afterTickId: afterTickIdRef.current,
            limit: 100,
        }).then((newTicks: TickRecord[]) => {
            if (selectionRef.current !== sel) return;
            if (newTicks.length === 0) return;

            afterTickIdRef.current = newTicks[newTicks.length - 1].tickId;
            setTicks((prev) => {
                const combined = [...prev, ...newTicks];
                return combined.length > ringBufferSize
                    ? combined.slice(combined.length - ringBufferSize)
                    : combined;
            });
        }).catch((err: unknown) => {
            console.log('[use-tick-poller] fetch error', err);
        });
    };

    // Polling when streaming
    useEffect(() => {
        if (!selection || !streaming) return;

        const id = setInterval(fetchTicks, pollRateMs);
        // Immediate first fetch
        fetchTicks();
        return () => clearInterval(id);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, streaming, pollRateMs]);

    // One-time historical load when not streaming
    useEffect(() => {
        if (!selection || streaming || historicalLoadedRef.current) return;
        historicalLoadedRef.current = true;
        fetchTicks();
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, streaming]);

    return ticks;
}
