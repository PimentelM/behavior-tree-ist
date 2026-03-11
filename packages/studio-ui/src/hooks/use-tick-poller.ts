import { useCallback, useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@bt-studio/core';
import type { StudioSelection } from '@bt-studio/react';
import { trpc } from '../trpc';

export type TickPollerMode = 'streaming' | 'windowed';

export interface TickPollerReturn {
    /**
     * Full current window sorted ascending by tickId.
     *
     * - In streaming mode: newest ticks appended; oldest evicted when windowSize exceeded.
     * - In windowed mode: updated by fetchBefore (prepend, evict newest) or seekToRange (replace).
     *
     * Consumer integration with TreeInspector:
     *   - Forward (streaming) ticks → inspector.ingestTicks(ticks)
     *   - Backward ticks from fetchBefore → inspector.insertTicksBefore(latestBackwardTicks)
     *   - Seek → inspector.clearTicks() then inspector.ingestTicks(ticks)
     */
    ticks: TickRecord[];
    /**
     * Ticks returned by the most recent fetchBefore call.
     * Pass to inspector.insertTicksBefore(). Resets to [] after next fetch completes.
     */
    latestBackwardTicks: TickRecord[];
    isLoading: boolean;
    error: unknown;
    /**
     * Fetch ticks before beforeTickId and prepend to the window.
     * Evicts from the newest end if window exceeds windowSize.
     * Only effective in windowed mode (no-op during streaming).
     */
    fetchBefore: (beforeTickId: number, limit?: number) => void;
    /**
     * Replace the current window with ticks from [fromTickId, toTickId].
     * Clears latestBackwardTicks.
     */
    seekToRange: (fromTickId: number, toTickId: number) => void;
}

export function useTickPoller(
    selection: StudioSelection | null,
    pollRateMs: number,
    windowSize: number,
    mode: TickPollerMode,
): TickPollerReturn {
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const [latestBackwardTicks, setLatestBackwardTicks] = useState<TickRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const afterTickIdRef = useRef(0);
    const selectionRef = useRef(selection);
    const fetchingRef = useRef(false);
    const windowSizeRef = useRef(windowSize);
    windowSizeRef.current = windowSize;

    // Reset on selection change
    useEffect(() => {
        selectionRef.current = selection;
        afterTickIdRef.current = 0;
        fetchingRef.current = false;
        setTicks([]);
        setLatestBackwardTicks([]);
        setError(null);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId]);

    const fetchForward = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel || fetchingRef.current) return;

        fetchingRef.current = true;
        setIsLoading(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (trpc.ticks.query.query as any)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            afterTickId: afterTickIdRef.current,
            limit: 100,
        }).then((newTicks: TickRecord[]) => {
            fetchingRef.current = false;
            setIsLoading(false);
            if (selectionRef.current !== sel) return;
            if (newTicks.length === 0) return;

            const newLastId = newTicks[newTicks.length - 1].tickId;
            if (newLastId <= afterTickIdRef.current) return;
            afterTickIdRef.current = newLastId;

            const cap = windowSizeRef.current;
            setTicks(prev => {
                const combined = [...prev, ...newTicks];
                return combined.length > cap ? combined.slice(combined.length - cap) : combined;
            });
        }).catch((err: unknown) => {
            fetchingRef.current = false;
            setIsLoading(false);
            setError(err);
            console.error('[use-tick-poller] forward fetch error', err);
        });
    }, []);

    const fetchBefore = useCallback((beforeTickId: number, limit: number = 100) => {
        const sel = selectionRef.current;
        if (!sel || fetchingRef.current) return;

        fetchingRef.current = true;
        setIsLoading(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((trpc.ticks as any).queryBefore.query as any)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            beforeTickId,
            limit,
        }).then((newTicks: TickRecord[]) => {
            fetchingRef.current = false;
            setIsLoading(false);
            if (selectionRef.current !== sel) return;

            const sorted = [...newTicks].sort((a, b) => a.tickId - b.tickId);
            setLatestBackwardTicks(sorted);

            if (sorted.length === 0) return;

            const cap = windowSizeRef.current;
            setTicks(prev => {
                const prevIds = new Set(prev.map(r => r.tickId));
                const deduped = sorted.filter(r => !prevIds.has(r.tickId));
                const combined = [...deduped, ...prev];
                return combined.length > cap ? combined.slice(0, cap) : combined;
            });
        }).catch((err: unknown) => {
            fetchingRef.current = false;
            setIsLoading(false);
            setError(err);
            console.error('[use-tick-poller] fetchBefore error', err);
        });
    }, []);

    const seekToRange = useCallback((fromTickId: number, toTickId: number) => {
        const sel = selectionRef.current;
        if (!sel || fetchingRef.current) return;

        fetchingRef.current = true;
        setIsLoading(true);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((trpc.ticks as any).range.query as any)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            fromTickId,
            toTickId,
            limit: windowSizeRef.current,
        }).then((newTicks: TickRecord[]) => {
            fetchingRef.current = false;
            setIsLoading(false);
            if (selectionRef.current !== sel) return;

            const sorted = [...newTicks].sort((a, b) => a.tickId - b.tickId);
            if (sorted.length > 0) {
                afterTickIdRef.current = sorted[sorted.length - 1].tickId;
            }
            setLatestBackwardTicks([]);
            setTicks(sorted);
        }).catch((err: unknown) => {
            fetchingRef.current = false;
            setIsLoading(false);
            setError(err);
            console.error('[use-tick-poller] seekToRange error', err);
        });
    }, []);

    // Streaming: auto-poll forward
    useEffect(() => {
        if (!selection || mode !== 'streaming') return;

        const id = setInterval(fetchForward, pollRateMs);
        fetchForward();
        return () => clearInterval(id);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, mode, pollRateMs, fetchForward]);

    return { ticks, latestBackwardTicks, isLoading, error, fetchBefore, seekToRange };
}
