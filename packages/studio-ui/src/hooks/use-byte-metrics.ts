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

        let cancelled = false;

        const fetch = async () => {
            const sel = selectionRef.current;
            if (!sel) return;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const data = await ((trpc as any).byteMetrics.query.query)({
                    clientId: sel.clientId,
                    sessionId: sel.sessionId,
                    treeId: sel.treeId,
                });
                if (!cancelled && selectionRef.current === sel) {
                    setResult(data as ByteMetricsResult);
                }
            } catch {
                // silently ignore — byte metrics are best-effort
            }
        };

        fetch();
        const id = setInterval(fetch, pollRateMs);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [selection?.clientId, selection?.sessionId, selection?.treeId, pollRateMs]);

    return result;
}
