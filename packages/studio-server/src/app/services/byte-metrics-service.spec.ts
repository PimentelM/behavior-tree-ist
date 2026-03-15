import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ByteMetricsService } from './byte-metrics-service';

describe('ByteMetricsService', () => {
    let service: ByteMetricsService;

    beforeEach(() => {
        service = new ByteMetricsService();
    });

    it('returns zero summary for unknown tree', () => {
        const result = service.query('c1', 's1', 't1');

        expect(result).toEqual({ rate: 0, totalBytes: 0, samples: [] });
    });

    it('records and returns samples with correct totalBytes', () => {
        service.record('c1', 's1', 't1', 1, 100);
        service.record('c1', 's1', 't1', 2, 200);

        const result = service.query('c1', 's1', 't1');

        expect(result.totalBytes).toBe(300);
        expect(result.samples).toHaveLength(2);
        expect(result.samples[0]).toMatchObject({ tickId: 1, bytes: 100 });
        expect(result.samples[1]).toMatchObject({ tickId: 2, bytes: 200 });
    });

    it('isolates metrics by tree key', () => {
        service.record('c1', 's1', 't1', 1, 100);
        service.record('c1', 's1', 't2', 2, 999);

        expect(service.query('c1', 's1', 't1').totalBytes).toBe(100);
        expect(service.query('c1', 's1', 't2').totalBytes).toBe(999);
    });

    it('evicts oldest sample when exceeding 500 samples', () => {
        for (let i = 0; i < 501; i++) {
            service.record('c1', 's1', 't1', i, 10);
        }

        const result = service.query('c1', 's1', 't1');

        expect(result.samples).toHaveLength(500);
        expect(result.samples[0].tickId).toBe(1);
    });

    it('computes rate from samples within 5s window', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now')
            .mockReturnValueOnce(now)        // record call 1 timestamp
            .mockReturnValueOnce(now)        // record call 2 timestamp
            .mockReturnValueOnce(now + 6000); // query: windowStart = now+1000, only samples at `now` fall outside

        service.record('c1', 's1', 't1', 1, 1000);
        service.record('c1', 's1', 't1', 2, 500);

        const result = service.query('c1', 's1', 't1');

        // Both samples are outside the 5s window (now < now+6000-5000=now+1000), rate=0
        expect(result.rate).toBe(0);
        expect(result.totalBytes).toBe(1500);

        vi.restoreAllMocks();
    });

    it('includes in-window samples in rate', () => {
        const now = Date.now();
        vi.spyOn(Date, 'now')
            .mockReturnValueOnce(now)       // record timestamp
            .mockReturnValueOnce(now + 1000); // query: windowStart = now-4000, sample at `now` is inside

        service.record('c1', 's1', 't1', 1, 5000);

        const result = service.query('c1', 's1', 't1');

        // 5000 bytes in RATE_WINDOW_MS=5000ms → 1000 bytes/s
        expect(result.rate).toBe(1000);

        vi.restoreAllMocks();
    });
});
