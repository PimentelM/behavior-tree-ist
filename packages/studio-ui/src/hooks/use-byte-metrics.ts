import { useState, useEffect, useRef } from 'react';
import type { StudioSelection } from '@bt-studio/react';
import { trpc } from '../trpc';

export interface ByteMetricsResult {
    samples: Array<{ tickId: number; bytes: number }>;
    ratePerSecond: number;
    totalBytes: number;
}

export function useByteMetrics(
    selection: StudioSelection | null,
    pollRateMs: number,
): ByteMetricsResult | null {
    const [result, setResult] = useState<ByteMetricsResult | null>(null);
    const selectionRef = useRef(selection);
    selectionRef.current = selection;

    useEffect(() => {
        setResult(null);
        if (!selection) return;

        const cancelRef: { current: boolean } = { current: false };

        const queryFn = trpc.byteMetrics.query.query;

        const fetchData = async () => {
            const sel = selectionRef.current;
            if (!sel) return;
            try {
                const data = await queryFn({ clientId: sel.clientId, sessionId: sel.sessionId, treeId: sel.treeId });
                if (!cancelRef.current && selectionRef.current === sel) {
                    setResult(data);
                }
            } catch {
                // silently ignore — byte metrics are best-effort
            }
        };

        void fetchData();
        const id = setInterval(() => { void fetchData(); }, pollRateMs);
        return () => {
            cancelRef.current = true;
            clearInterval(id);
        };
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, pollRateMs]);

    return result;
}
