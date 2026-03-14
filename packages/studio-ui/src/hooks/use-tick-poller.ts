import { useCallback, useEffect, useRef, useState } from 'react';
import type { TickRecord } from '@bt-studio/core';
import type { StudioSelection } from '@bt-studio/react';
import { trpc } from '../trpc';

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
            console.error('[use-tick-poller] forward fetch error', err);
        });
    }, []);

    // Always-on live polling: seed from latest then poll forward
    useEffect(() => {
        if (!selection) return;

        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;
        const sel = selectionRef.current;
        if (!sel) return;

        setIsLoading(true);

        void (async () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const bounds = await (trpc.ticks.bounds.query as any)({
                    clientId: sel.clientId,
                    sessionId: sel.sessionId,
                    treeId: sel.treeId,
                });

                if (cancelled || selectionRef.current !== sel) return;

                if (bounds?.maxTickId > 0) {
                    const maxTickId: number = bounds.maxTickId;
                    const cap = ringBufferSizeRef.current;
                    const fromTickId = Math.max(0, maxTickId - cap + 1);

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const seedTicks: TickRecord[] = await ((trpc.ticks as any).range.query as any)({
                        clientId: sel.clientId,
                        sessionId: sel.sessionId,
                        treeId: sel.treeId,
                        fromTickId,
                        toTickId: maxTickId,
                        limit: cap,
                    });

                    if (cancelled || selectionRef.current !== sel) return;

                    const sorted = [...seedTicks].sort((a, b) => a.tickId - b.tickId);
                    afterTickIdRef.current = maxTickId;
                    setTicks(sorted);
                }
            } catch (err) {
                if (!cancelled && selectionRef.current === sel) {
                    setError(err);
                    console.error('[use-tick-poller] seed error', err);
                }
            } finally {
                if (!cancelled && selectionRef.current === sel) {
                    setIsLoading(false);
                }
            }

            if (!cancelled && selectionRef.current === sel) {
                intervalId = setInterval(fetchForward, pollRateMs);
                fetchForward();
            }
        })();

        return () => {
            cancelled = true;
            setIsLoading(false);
            if (intervalId !== null) clearInterval(intervalId);
        };
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, pollRateMs, fetchForward]);

    return { ticks, isLoading, error };
}
