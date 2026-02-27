import { RingBuffer } from "./ring-buffer";
import { TickTraceEvent, TickRecord } from "../base/types";
import { NodeTickSnapshot, TreeTickSnapshot } from "./types";

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

        if (this.buffer.size > 0 && tickId <= this.buffer.peekLast()!.tickId) {
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
    getNodeHistory(nodeId: number): TickTraceEvent[] {
        const result: TickTraceEvent[] = [];
        this.buffer.forEach(record => {
            for (const event of record.events) {
                if (event.nodeId === nodeId) {
                    result.push(event);
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

    get size(): number {
        return this.buffer.size;
    }

    clear(): void {
        this.buffer.clear();
        this.byTickId.clear();
    }
}
