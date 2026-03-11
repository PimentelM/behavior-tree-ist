import { describe, it, expect } from "vitest";
import { RingBuffer } from "./ring-buffer";

describe("RingBuffer", () => {
    it("handles basic push and peek", () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1);
        expect(rb.size).toBe(1);
        expect(rb.peekFirst()).toBe(1);
        expect(rb.peekLast()).toBe(1);

        rb.push(2);
        expect(rb.size).toBe(2);
        expect(rb.peekFirst()).toBe(1);
        expect(rb.peekLast()).toBe(2);
    });

    it("evicts oldest on overflow", () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);

        expect(rb.size).toBe(3);
        expect(rb.peekFirst()).toBe(2);
        expect(rb.peekLast()).toBe(4);
    });

    it("forEach iterates in insertion order", () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1);
        rb.push(2);
        rb.push(3);
        rb.push(4);

        const items: number[] = [];
        rb.forEach(item => items.push(item));
        expect(items).toEqual([2, 3, 4]);
    });

    it("clear resets all state", () => {
        const rb = new RingBuffer<number>(3);
        rb.push(1);
        rb.clear();

        expect(rb.size).toBe(0);
        expect(rb.peekFirst()).toBeUndefined();
        expect(rb.peekLast()).toBeUndefined();

        let iterated = false;
        rb.forEach(() => { iterated = true; });
        expect(iterated).toBe(false);
    });

    it("handles capacity 1 edge case", () => {
        const rb = new RingBuffer<number>(1);
        rb.push(8);
        expect(rb.peekFirst()).toBe(8);
        expect(rb.peekLast()).toBe(8);

        rb.push(9);
        expect(rb.peekFirst()).toBe(9);
        expect(rb.peekLast()).toBe(9);
        expect(rb.size).toBe(1);
    });

    it("empty peek returns undefined", () => {
        const rb = new RingBuffer<number>(2);
        expect(rb.peekFirst()).toBeUndefined();
        expect(rb.peekLast()).toBeUndefined();
    });

    describe("pushMany", () => {
        it("pushes multiple items without overflow", () => {
            const rb = new RingBuffer<number>(5);

            const evicted = rb.pushMany([1, 2, 3]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(3);
            expect(rb.peekFirst()).toBe(1);
            expect(rb.peekLast()).toBe(3);
        });

        it("returns evicted items on overflow", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(1);
            rb.push(2);

            const evicted = rb.pushMany([3, 4, 5]);

            expect(evicted).toEqual([1, 2]);
            expect(rb.size).toBe(3);
            expect(rb.peekFirst()).toBe(3);
            expect(rb.peekLast()).toBe(5);
        });

        it("handles batch larger than capacity", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(0);

            const evicted = rb.pushMany([1, 2, 3, 4, 5]);

            expect(evicted).toEqual([0]);
            expect(rb.size).toBe(3);
            expect(rb.peekFirst()).toBe(3);
            expect(rb.peekLast()).toBe(5);
        });

        it("handles empty array", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(1);

            const evicted = rb.pushMany([]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(1);
            expect(rb.peekFirst()).toBe(1);
        });

        it("produces same result as sequential push", () => {
            const sequential = new RingBuffer<number>(3);
            for (const n of [1, 2, 3, 4, 5]) sequential.push(n);

            const batch = new RingBuffer<number>(3);
            batch.pushMany([1, 2, 3, 4, 5]);

            const seqItems: number[] = [];
            sequential.forEach(i => seqItems.push(i));
            const batchItems: number[] = [];
            batch.forEach(i => batchItems.push(i));
            expect(batchItems).toEqual(seqItems);
        });

        it("handles capacity 1 with batch", () => {
            const rb = new RingBuffer<number>(1);

            const evicted = rb.pushMany([10, 20, 30]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(1);
            expect(rb.peekFirst()).toBe(30);
        });
    });

    describe("unshift", () => {
        it("prepends to empty buffer", () => {
            const rb = new RingBuffer<number>(3);

            const evicted = rb.unshift(1);

            expect(evicted).toBeUndefined();
            expect(rb.size).toBe(1);
            expect(rb.peekFirst()).toBe(1);
            expect(rb.peekLast()).toBe(1);
        });

        it("prepends multiple items maintaining order", () => {
            const rb = new RingBuffer<number>(5);
            rb.push(4);
            rb.push(5);

            rb.unshift(3);
            rb.unshift(2);
            rb.unshift(1);

            const items: number[] = [];
            rb.forEach(i => items.push(i));
            expect(items).toEqual([1, 2, 3, 4, 5]);
        });

        it("evicts from tail (newest) when full", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(2);
            rb.push(3);
            rb.push(4);

            const evicted = rb.unshift(1);

            expect(evicted).toBe(4);
            expect(rb.size).toBe(3);
            expect(rb.peekFirst()).toBe(1);
            expect(rb.peekLast()).toBe(3);
        });

        it("handles capacity 1", () => {
            const rb = new RingBuffer<number>(1);
            rb.push(10);

            const evicted = rb.unshift(5);

            expect(evicted).toBe(10);
            expect(rb.peekFirst()).toBe(5);
        });
    });

    describe("unshiftMany", () => {
        it("prepends items without overflow", () => {
            const rb = new RingBuffer<number>(5);
            rb.push(4);
            rb.push(5);

            const evicted = rb.unshiftMany([1, 2, 3]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(5);
            const items: number[] = [];
            rb.forEach(i => items.push(i));
            expect(items).toEqual([1, 2, 3, 4, 5]);
        });

        it("evicts from tail when overflow", () => {
            const rb = new RingBuffer<number>(4);
            rb.push(4);
            rb.push(5);
            rb.push(6);

            const evicted = rb.unshiftMany([1, 2, 3]);

            expect(evicted).toEqual([6, 5]);
            expect(rb.size).toBe(4);
            const items: number[] = [];
            rb.forEach(i => items.push(i));
            expect(items).toEqual([1, 2, 3, 4]);
        });

        it("handles batch >= capacity: evicts all existing, keeps newest of input", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(10);
            rb.push(11);

            const evicted = rb.unshiftMany([1, 2, 3, 4, 5]);

            expect(evicted).toEqual([10, 11]);
            expect(rb.size).toBe(3);
            const items: number[] = [];
            rb.forEach(i => items.push(i));
            expect(items).toEqual([3, 4, 5]);
        });

        it("handles empty input", () => {
            const rb = new RingBuffer<number>(3);
            rb.push(1);

            const evicted = rb.unshiftMany([]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(1);
        });

        it("produces correct order when combined with existing items", () => {
            const rb = new RingBuffer<number>(5);
            rb.push(3);
            rb.push(4);
            rb.push(5);

            rb.unshiftMany([1, 2]);

            const items: number[] = [];
            rb.forEach(i => items.push(i));
            expect(items).toEqual([1, 2, 3, 4, 5]);
        });

        it("capacity 1 keeps last item of input", () => {
            const rb = new RingBuffer<number>(1);

            const evicted = rb.unshiftMany([1, 2, 3]);

            expect(evicted).toEqual([]);
            expect(rb.size).toBe(1);
            expect(rb.peekFirst()).toBe(3);
        });
    });
});
