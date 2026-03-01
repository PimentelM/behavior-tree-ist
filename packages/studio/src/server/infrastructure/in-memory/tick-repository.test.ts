import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryTickRepository } from "./tick-repository";

describe("InMemoryTickRepository", () => {
    let repo: InMemoryTickRepository;
    let limit = 100;

    beforeEach(() => {
        limit = 100;
        repo = new InMemoryTickRepository(() => ({ maxTickRecordsPerTree: limit }));
    });

    it("pushes and queries ticks", () => {
        repo.push("c1", "t1", [{ tickId: 1, trace: [] }]);
        repo.push("c1", "t1", [{ tickId: 2, trace: [] }]);

        const ticks = repo.query("c1", "t1");
        expect(ticks).toHaveLength(2);
        expect(ticks[0].tickId).toBe(1);
        expect(ticks[1].tickId).toBe(2);
    });

    it("respects maxTickRecordsPerTree limit", () => {
        limit = 2;
        repo.push("c1", "t1", [
            { tickId: 1, trace: [] },
            { tickId: 2, trace: [] },
            { tickId: 3, trace: [] }
        ]);

        const ticks = repo.query("c1", "t1");
        expect(ticks).toHaveLength(2);
        expect(ticks[0].tickId).toBe(2);
        expect(ticks[1].tickId).toBe(3);
    });

    it("queries after specific tickId", () => {
        repo.push("c1", "t1", [
            { tickId: 1, trace: [] },
            { tickId: 2, trace: [] },
            { tickId: 3, trace: [] }
        ]);

        const ticks = repo.query("c1", "t1", 1);
        expect(ticks).toHaveLength(2);
        expect(ticks[0].tickId).toBe(2);
    });

    it("queries with limit", () => {
        repo.push("c1", "t1", [
            { tickId: 1, trace: [] },
            { tickId: 2, trace: [] },
            { tickId: 3, trace: [] }
        ]);

        const ticks = repo.query("c1", "t1", undefined, 2);
        expect(ticks).toHaveLength(2);
        expect(ticks[0].tickId).toBe(2);
        expect(ticks[1].tickId).toBe(3);
    });

    it("clears by tree", () => {
        repo.push("c1", "t1", [{ tickId: 1, trace: [] }]);
        repo.clearByTree("c1", "t1");

        expect(repo.query("c1", "t1")).toHaveLength(0);
    });

    it("clears by client", () => {
        repo.push("c1", "t1", [{ tickId: 1, trace: [] }]);
        repo.push("c1", "t2", [{ tickId: 2, trace: [] }]);
        repo.push("c2", "t1", [{ tickId: 3, trace: [] }]);

        repo.clearByClient("c1");

        expect(repo.query("c1", "t1")).toHaveLength(0);
        expect(repo.query("c1", "t2")).toHaveLength(0);
        expect(repo.query("c2", "t1")).toHaveLength(1);
    });
});
