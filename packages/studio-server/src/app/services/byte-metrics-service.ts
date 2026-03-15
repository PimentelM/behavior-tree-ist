export interface ByteSample {
    tickId: number;
    bytes: number;
}

interface TimedByteSample extends ByteSample {
    timestamp: number;
}

export interface ByteMetricsQuery {
    samples: ByteSample[];
    ratePerSecond: number;
    totalBytes: number;
}

export interface ByteMetricsServiceInterface {
    record(clientId: string, sessionId: string, treeId: string, tickId: number, bytes: number): void;
    query(clientId: string, sessionId: string, treeId: string): ByteMetricsQuery;
    clearByAgent(clientId: string, sessionId: string): void;
}

export class ByteMetricsService implements ByteMetricsServiceInterface {
    private readonly samples = new Map<string, TimedByteSample[]>();
    private readonly maxSamples: number;
    private readonly windowMs: number;

    constructor(maxSamples = 1000, windowMs = 5000) {
        this.maxSamples = maxSamples;
        this.windowMs = windowMs;
    }

    private key(clientId: string, sessionId: string, treeId: string): string {
        return `${clientId}:${sessionId}:${treeId}`;
    }

    record(clientId: string, sessionId: string, treeId: string, tickId: number, bytes: number): void {
        const k = this.key(clientId, sessionId, treeId);
        if (!this.samples.has(k)) this.samples.set(k, []);
        const arr = this.samples.get(k)!;
        arr.push({ tickId, bytes, timestamp: Date.now() });
        if (arr.length > this.maxSamples) arr.shift();
    }

    clearByAgent(clientId: string, sessionId: string): void {
        const prefix = `${clientId}:${sessionId}:`;
        for (const key of this.samples.keys()) {
            if (key.startsWith(prefix)) {
                this.samples.delete(key);
            }
        }
    }

    query(clientId: string, sessionId: string, treeId: string): ByteMetricsQuery {
        const k = this.key(clientId, sessionId, treeId);
        const arr = this.samples.get(k) ?? [];
        const now = Date.now();
        const windowBytes = arr
            .filter(s => now - s.timestamp < this.windowMs)
            .reduce((sum, s) => sum + s.bytes, 0);
        const ratePerSecond = windowBytes / (this.windowMs / 1000);
        const totalBytes = arr.reduce((sum, s) => sum + s.bytes, 0);
        return {
            samples: arr.map(({ tickId, bytes }) => ({ tickId, bytes })),
            ratePerSecond,
            totalBytes,
        };
    }
}
