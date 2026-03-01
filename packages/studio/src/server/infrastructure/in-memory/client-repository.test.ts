import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryClientRepository } from "./client-repository";

describe("InMemoryClientRepository", () => {
    let repo: InMemoryClientRepository;

    beforeEach(() => {
        repo = new InMemoryClientRepository();
    });

    it("upserts and finds clients", () => {
        repo.upsert({ clientId: "c1", isOnline: true });

        const client = repo.findById("c1");
        expect(client).toBeDefined();
        expect(client?.clientId).toBe("c1");
        expect(client?.isOnline).toBe(true);
    });

    it("returns a copy to avoid mutation", () => {
        repo.upsert({ clientId: "c1", isOnline: true });

        const client = repo.findById("c1")!;
        client.isOnline = false;

        const again = repo.findById("c1")!;
        expect(again.isOnline).toBe(true);
    });

    it("finds all clients", () => {
        repo.upsert({ clientId: "c1", isOnline: true });
        repo.upsert({ clientId: "c2", isOnline: false });

        const all = repo.findAll();
        expect(all).toHaveLength(2);
    });

    it("deletes clients", () => {
        repo.upsert({ clientId: "c1", isOnline: true });
        repo.delete("c1");
        expect(repo.findById("c1")).toBeUndefined();
    });

    it("sets online state and timestamps", () => {
        repo.upsert({ clientId: "c1", isOnline: true });

        repo.setOnline("c1", false, 100);
        let client = repo.findById("c1")!;
        expect(client.isOnline).toBe(false);
        expect(client.disconnectedAt).toBe(100);

        repo.setOnline("c1", true, 200);
        client = repo.findById("c1")!;
        expect(client.isOnline).toBe(true);
        expect(client.connectedAt).toBe(200);
        expect(client.disconnectedAt).toBeUndefined();
    });
});
