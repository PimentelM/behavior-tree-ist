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
});
