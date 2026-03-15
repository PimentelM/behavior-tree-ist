import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ByteMetricsService } from './byte-metrics-service';

describe('ByteMetricsService', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns empty result for unknown tree', () => {
        const svc = new ByteMetricsService();

        const result = svc.query('c', 's', 't');

        expect(result).toEqual({ samples: [], ratePerSecond: 0, totalBytes: 0 });
    });

    it('records and returns samples', () => {
        const svc = new ByteMetricsService();

        svc.record('c', 's', 't', 1, 100);
        svc.record('c', 's', 't', 2, 200);

        const result = svc.query('c', 's', 't');

        expect(result.samples).toEqual([
            { tickId: 1, bytes: 100 },
            { tickId: 2, bytes: 200 },
        ]);
        expect(result.totalBytes).toBe(300);
    });

    it('computes rate from samples within window', () => {
        const svc = new ByteMetricsService(1000, 5000);

        svc.record('c', 's', 't', 1, 5000);

        const result = svc.query('c', 's', 't');

        expect(result.ratePerSecond).toBe(1000); // 5000 bytes / 5s window
    });

    it('excludes expired samples from rate but not totalBytes', () => {
        const svc = new ByteMetricsService(1000, 5000);

        svc.record('c', 's', 't', 1, 1000);
        vi.advanceTimersByTime(6000); // expire the first sample
        svc.record('c', 's', 't', 2, 500);

        const result = svc.query('c', 's', 't');

        expect(result.totalBytes).toBe(1500); // all samples
        expect(result.ratePerSecond).toBe(100); // only 500 bytes in window / 5s
    });

    it('evicts oldest when maxSamples exceeded', () => {
        const svc = new ByteMetricsService(2);

        svc.record('c', 's', 't', 1, 10);
        svc.record('c', 's', 't', 2, 20);
        svc.record('c', 's', 't', 3, 30);

        const result = svc.query('c', 's', 't');

        expect(result.samples).toHaveLength(2);
        expect(result.samples[0].tickId).toBe(2);
        expect(result.samples[1].tickId).toBe(3);
    });

    it('isolates samples per tree key', () => {
        const svc = new ByteMetricsService();

        svc.record('c', 's', 'tree-a', 1, 100);
        svc.record('c', 's', 'tree-b', 1, 999);

        expect(svc.query('c', 's', 'tree-a').totalBytes).toBe(100);
        expect(svc.query('c', 's', 'tree-b').totalBytes).toBe(999);
    });
});
