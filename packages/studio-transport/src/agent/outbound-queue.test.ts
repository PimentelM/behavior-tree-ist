import { describe, it, expect } from "vitest";
import { OutboundQueue } from "./outbound-queue";

describe("OutboundQueue", () => {
    it("push within capacity retains all items", () => {
        const q = new OutboundQueue<number>(3);
        q.push(1);
        q.push(2);

        expect(q.size).toBe(2);
        expect(q.drain()).toEqual([1, 2]);
    });

    it("push at capacity evicts oldest", () => {
        const q = new OutboundQueue<number>(3);
        q.push(1);
        q.push(2);
        q.push(3);
        q.push(4);

        expect(q.size).toBe(3);
        expect(q.drain()).toEqual([2, 3, 4]);
    });

    it("drain returns all items in FIFO order and empties queue", () => {
        const q = new OutboundQueue<number>(3);
        q.push(7);
        q.push(8);

        const drained = q.drain();
        expect(drained).toEqual([7, 8]);
        expect(q.size).toBe(0);
        expect(q.drain()).toEqual([]);
    });

    it("size tracks correctly", () => {
        const q = new OutboundQueue<number>(2);
        expect(q.size).toBe(0);
        q.push(1);
        expect(q.size).toBe(1);
        q.push(2);
        expect(q.size).toBe(2);
        q.push(3);
        expect(q.size).toBe(2); // capacity is 2
    });
});
