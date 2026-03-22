import { useCallback, useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@bt-studio/core';
import type { StudioSelection } from '@bt-studio/react';
import { trpc, asProcedure } from '../trpc';

export interface TickPollerReturn {
    /**
     * Full current window sorted ascending by tickId.
     * Always reflects the live ring buffer (newest ticks appended; oldest evicted when windowSize exceeded).
     */
    ticks: TickRecord[];
    isLoading: boolean;
    error: unknown;
}

export function useTickPoller(
    selection: StudioSelection | null,
    pollRateMs: number,
    ringBufferSize: number,
): TickPollerReturn {
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<unknown>(null);

    const afterTickIdRef = useRef(0);
    const selectionRef = useRef(selection);
    const fetchingRef = useRef(false);
    const ringBufferSizeRef = useRef(ringBufferSize);
    ringBufferSizeRef.current = ringBufferSize;

    // Reset on selection change
    useEffect(() => {
        selectionRef.current = selection;
        afterTickIdRef.current = 0;
        fetchingRef.current = false;
        setTicks([]);
        setError(null);
    }, [selection?.clientId, selection?.sessionId, selection?.treeId]);

    const fetchForward = useCallback(() => {
        const sel = selectionRef.current;
        if (!sel || fetchingRef.current) return;

        fetchingRef.current = true;

        void asProcedure<{ clientId: string; sessionId: string; treeId: string; afterTickId?: number; limit?: number }, TickRecord[]>(trpc.ticks.query.query)({
            clientId: sel.clientId,
            sessionId: sel.sessionId,
            treeId: sel.treeId,
            afterTickId: afterTickIdRef.current,
            limit: 100,
        }).then((newTicks) => {
            fetchingRef.current = false;
            if (selectionRef.current !== sel) return;
            if (newTicks.length === 0) return;

            const newLastId = (newTicks[newTicks.length - 1] as (typeof newTicks)[number]).tickId;
            if (newLastId <= afterTickIdRef.current) return;
            afterTickIdRef.current = newLastId;

            const cap = ringBufferSizeRef.current;
            setTicks(prev => {
                const combined = [...prev, ...newTicks];
                return combined.length > cap ? combined.slice(combined.length - cap) : combined;
            });
        }).catch((err: unknown) => {
            fetchingRef.current = false;
            setError(err);
            // eslint-disable-next-line no-console
            console.error('[use-tick-poller] forward fetch error', err);
        });
    }, []);

    // Always-on live polling: seed from latest then poll forward
    useEffect(() => {
        if (!selection) return;

        const cancelRef: { current: boolean } = { current: false };
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const sel = selectionRef.current;
        if (!sel) return;

        setIsLoading(true);

        void (async () => {
            try {
                const bounds = await trpc.ticks.bounds.query({
                    clientId: sel.clientId,
                    sessionId: sel.sessionId,
                    treeId: sel.treeId,
                });

                if (cancelRef.current || selectionRef.current !== sel) return;

                if (bounds?.maxTickId != null && bounds.maxTickId > 0) {
                    const maxTickId: number = bounds.maxTickId;
                    const cap = ringBufferSizeRef.current;
                    const fromTickId = Math.max(0, maxTickId - cap + 1);

                    const seedTicks = await asProcedure<{ clientId: string; sessionId: string; treeId: string; fromTickId: number; toTickId: number; limit?: number }, TickRecord[]>(trpc.ticks.range.query)({
                        clientId: sel.clientId,
                        sessionId: sel.sessionId,
                        treeId: sel.treeId,
                        fromTickId,
                        toTickId: maxTickId,
                        limit: cap,
                    });

                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    if (cancelRef.current || selectionRef.current !== sel) return;

                    const sorted = [...seedTicks].sort((a, b) => a.tickId - b.tickId);
                    afterTickIdRef.current = maxTickId;
                    setTicks(sorted);
                }
            } catch (err) {
                if (!cancelRef.current && selectionRef.current === sel) {
                    setError(err);
                    // eslint-disable-next-line no-console
                    console.error('[use-tick-poller] seed error', err);
                }
            } finally {
                if (!cancelRef.current && selectionRef.current === sel) {
                    setIsLoading(false);
                }
            }

            if (!cancelRef.current && selectionRef.current === sel) {
                intervalId = setInterval(fetchForward, pollRateMs);
                fetchForward();
            }
        })();

        return () => {
            cancelRef.current = true;
            setIsLoading(false);
            if (intervalId !== null) clearInterval(intervalId);
        };
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, pollRateMs, fetchForward]);

    return { ticks, isLoading, error };
}
