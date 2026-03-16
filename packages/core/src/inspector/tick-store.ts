import { RingBuffer } from "./ring-buffer";
import { type TickTraceEvent, type NodeHistoryEvent, type TickRecord } from "../base/types";
import { type NodeTickSnapshot, type TreeTickSnapshot } from "./types";

export class TickStore {
    private readonly buffer: RingBuffer<TickRecord>;
    private readonly byTickId = new Map<number, TickRecord>();
    private readonly capacity: number;

    constructor(maxTicks: number = 1000) {
        this.capacity = maxTicks;
        this.buffer = new RingBuffer<TickRecord>(maxTicks);
    }

    /**
     * Push a tick's events into the store.
     * Returns the evicted TickRecord if the buffer was full, undefined otherwise.
     */
    push(record: TickRecord): TickRecord | undefined {
        if (record.events.length === 0) return undefined;

        const tickId = record.tickId;

        if (this.buffer.size > 0 && tickId <= (this.buffer.peekLast() as TickRecord).tickId) {
            return undefined; // ignore older or duplicate ticks
        }

        let evicted: TickRecord | undefined;

        // If buffer is at capacity, the oldest item will be evicted
        if (this.buffer.size === this.capacity) {
            evicted = this.buffer.peekFirst();
            if (evicted) {
                this.byTickId.delete(evicted.tickId);
            }
        }

        this.buffer.push(record);
        this.byTickId.set(tickId, record);

        return evicted;
    }

    /**
     * Push multiple tick records at once.
     * Filters empty events and out-of-order/duplicate ticks.
     * Returns all evicted TickRecords (including valid records that overflowed within the batch).
     */
    pushMany(records: TickRecord[]): TickRecord[] {
        // Filter: non-empty, monotonically increasing relative to current newest
        const valid: TickRecord[] = [];
        let lastId = this.buffer.size > 0 ? (this.buffer.peekLast() as TickRecord).tickId : -Infinity;
        for (const record of records) {
            if (record.events.length === 0) continue;
            if (record.tickId <= lastId) continue;
            lastId = record.tickId;
            valid.push(record);
        }

        if (valid.length === 0) return [];

        const allEvicted: TickRecord[] = [];

        // Pre-existing items evicted from ring buffer
        const evictedFromBuffer = this.buffer.pushMany(valid);
        for (const evicted of evictedFromBuffer) {
            this.byTickId.delete(evicted.tickId);
            allEvicted.push(evicted);
        }

        // Valid items that didn't survive (batch exceeded capacity)
        if (valid.length > this.capacity) {
            const droppedCount = valid.length - this.capacity;
            for (const record of valid.slice(0, droppedCount)) {
                allEvicted.push(record);
            }
        }

        // Only add surviving records to byTickId
        const survivorStart = Math.max(0, valid.length - this.capacity);
        for (const record of valid.slice(survivorStart)) {
            this.byTickId.set(record.tickId, record);
        }

        return allEvicted;
    }

    getByTickId(tickId: number): TickRecord | undefined {
        return this.byTickId.get(tickId);
    }

    hasTick(tickId: number): boolean {
        return this.byTickId.has(tickId);
    }

    /**
     * Reconstruct per-node state from trace events at a specific tick.
     */
    getSnapshotAtTick(tickId: number): TreeTickSnapshot | undefined {
        const record = this.byTickId.get(tickId);
        if (!record) return undefined;

        const nodes = new Map<number, NodeTickSnapshot>();
        for (const event of record.events) {
            nodes.set(event.nodeId, {
                nodeId: event.nodeId,
                result: event.result,
                state: event.state,
                startedAt: event.startedAt,
                finishedAt: event.finishedAt,
            });
        }

        return { tickId, timestamp: record.timestamp, nodes };
    }

    /**
     * Get all events for a specific node across all stored ticks.
     */
    getNodeHistory(nodeId: number): NodeHistoryEvent[] {
        const result: NodeHistoryEvent[] = [];
        this.buffer.forEach(record => {
            for (const event of record.events) {
                if (event.nodeId === nodeId) {
                    result.push({ ...event, tickId: record.tickId, timestamp: record.timestamp });
                }
            }
        });
        return result;
    }

    getLastNodeState(nodeId: number, atOrBeforeTickId?: number): TickTraceEvent["state"] | undefined {
        let lastState: TickTraceEvent["state"] | undefined;

        this.buffer.forEach(record => {
            if (atOrBeforeTickId !== undefined && record.tickId > atOrBeforeTickId) {
                return;
            }

            for (const event of record.events) {
                if (event.nodeId === nodeId && event.state !== undefined) {
                    lastState = event.state;
                }
            }
        });

        return lastState;
    }

    getStoredTickIds(): number[] {
        const ids: number[] = [];
        this.buffer.forEach(record => ids.push(record.tickId));
        return ids;
    }

    getTickRange(from: number, to: number): TickRecord[] {
        const result: TickRecord[] = [];
        this.buffer.forEach(record => {
            if (record.tickId >= from && record.tickId <= to) {
                result.push(record);
            }
        });
        return result;
    }

    get oldestTickId(): number | undefined {
        return this.buffer.peekFirst()?.tickId;
    }

    get newestTickId(): number | undefined {
        return this.buffer.peekLast()?.tickId;
    }

    get oldestRecord(): TickRecord | undefined {
        return this.buffer.peekFirst();
    }

    get newestRecord(): TickRecord | undefined {
        return this.buffer.peekLast();
    }

    getProfilingWindowBounds(): {
        start: number | undefined;
        end: number | undefined;
        span: number;
    } {
        const oldest = this.oldestRecord;
        const newest = this.newestRecord;

        if (!oldest || !newest) {
            return { start: undefined, end: undefined, span: 0 };
        }

        const startCandidates = oldest.events
            .map((event) => event.startedAt)
            .filter((value): value is number => value !== undefined);
        const endCandidates = newest.events
            .map((event) => event.finishedAt)
            .filter((value): value is number => value !== undefined);

        const start = startCandidates.length > 0
            ? Math.min(...startCandidates)
            : oldest.timestamp;
        const end = endCandidates.length > 0
            ? Math.max(...endCandidates)
            : newest.timestamp;

        return {
            start,
            end,
            span: Math.max(0, end - start),
        };
    }

    get size(): number {
        return this.buffer.size;
    }

    clear(): void {
        this.buffer.clear();
        this.byTickId.clear();
    }
}
