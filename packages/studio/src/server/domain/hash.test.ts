import { describe, it, expect } from "vitest";
import { computeTreeHash } from "./hash";

describe("computeTreeHash", () => {
    const nodeA = { id: 1, type: "action" as const, name: "NodeA", nodeFlags: 0, defaultName: "NodeA" };
    const nodeB = { id: 1, type: "action" as const, name: "NodeB", nodeFlags: 0, defaultName: "NodeB" };

    it("same serialized tree produces same hash", () => {
        const hash1 = computeTreeHash(nodeA);
        const hash2 = computeTreeHash(nodeA);
        expect(hash1).toBe(hash2);
    });

    it("different serialized tree produces different hash", () => {
        const hash1 = computeTreeHash(nodeA);
        const hash2 = computeTreeHash(nodeB);
        expect(hash1).not.toBe(hash2);
    });

    it("hash is deterministic (no randomness)", () => {
        const hash1 = computeTreeHash(nodeA);
        for (let i = 0; i < 10; i++) {
            expect(computeTreeHash(nodeA)).toBe(hash1);
        }
    });
});
