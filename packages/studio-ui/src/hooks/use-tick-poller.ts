import { useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@bt-studio/core';
import type { StudioSelection } from '@bt-studio/react';
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
    const fetchingRef = useRef(false);
    const ringBufferSizeRef = useRef(ringBufferSize);
    ringBufferSizeRef.current = ringBufferSize;

    // Reset on selection change
    useEffect(() => {
        selectionRef.current = selection;
        afterTickIdRef.current = 0;
        historicalLoadedRef.current = false;
        fetchingRef.current = false;
        setTicks([]);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId]);

    const fetchTicks = () => {
        const sel = selectionRef.current;
        if (!sel || fetchingRef.current) return;

        fetchingRef.current = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (trpc.ticks.query.query as any)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            afterTickId: afterTickIdRef.current,
            limit: 100,
        }).then((newTicks: TickRecord[]) => {
            fetchingRef.current = false;
            if (selectionRef.current !== sel) return;
            if (newTicks.length === 0) return;

            const newLastId = newTicks[newTicks.length - 1].tickId;
            // Discard stale responses that arrived out of order
            if (newLastId <= afterTickIdRef.current) return;
            afterTickIdRef.current = newLastId;

            const cap = ringBufferSizeRef.current;
            setTicks((prev) => {
                const combined = [...prev, ...newTicks];
                return combined.length > cap
                    ? combined.slice(combined.length - cap)
                    : combined;
            });
        }).catch((err: unknown) => {
            fetchingRef.current = false;
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
