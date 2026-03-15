const MAX_SAMPLES = 500;
const RATE_WINDOW_MS = 5000;

export interface ByteSample {
    tickId: number;
    bytes: number;
    timestamp: number;
}

export interface ByteMetricsSummary {
    rate: number;
    totalBytes: number;
    samples: ByteSample[];
}

interface TreeMetrics {
    samples: ByteSample[];
    totalBytes: number;
}

export class ByteMetricsService {
    private store = new Map<string, TreeMetrics>();

    private key(clientId: string, sessionId: string, treeId: string): string {
        return `${clientId}::${sessionId}::${treeId}`;
    }

    record(clientId: string, sessionId: string, treeId: string, tickId: number, bytes: number): void {
        const k = this.key(clientId, sessionId, treeId);
        let entry = this.store.get(k);
        if (!entry) {
            entry = { samples: [], totalBytes: 0 };
            this.store.set(k, entry);
        }

        entry.samples.push({ tickId, bytes, timestamp: Date.now() });
        if (entry.samples.length > MAX_SAMPLES) {
            entry.samples.shift();
        }
        entry.totalBytes += bytes;
    }

    query(clientId: string, sessionId: string, treeId: string): ByteMetricsSummary {
        const entry = this.store.get(this.key(clientId, sessionId, treeId));
        if (!entry) return { rate: 0, totalBytes: 0, samples: [] };

        const windowStart = Date.now() - RATE_WINDOW_MS;
        let windowBytes = 0;
        for (const s of entry.samples) {
            if (s.timestamp >= windowStart) windowBytes += s.bytes;
        }
        const rate = windowBytes / (RATE_WINDOW_MS / 1000);

        return { rate, totalBytes: entry.totalBytes, samples: entry.samples };
    }
}
