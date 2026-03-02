import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTreeRepository } from "./tree-repository";
import { SerializableNode } from "@behavior-tree-ist/core";

describe("InMemoryTreeRepository", () => {
    let repo: InMemoryTreeRepository;
    const mockNode: SerializableNode = { id: 1, name: "Node", nodeFlags: 0, defaultName: "Node" };

    beforeEach(() => {
        repo = new InMemoryTreeRepository();
    });

    it("upserts and finds trees", () => {
        repo.upsert("c1", "t1", mockNode, "hash1");
        const tree = repo.find("c1", "t1");
        expect(tree).toBeDefined();
        expect(tree?.hash).toBe("hash1");
    });

    it("updates existing tree", () => {
        repo.upsert("c1", "t1", mockNode, "hash1");
        repo.upsert("c1", "t1", mockNode, "hash2");

        const tree = repo.find("c1", "t1");
        expect(tree?.hash).toBe("hash2");
    });

    it("finds all trees for a client", () => {
        repo.upsert("c1", "t1", mockNode, "hash1");
        repo.upsert("c1", "t2", mockNode, "hash2");
        repo.upsert("c2", "t1", mockNode, "hash3");

        const client1Trees = repo.findByClient("c1");
        expect(client1Trees).toHaveLength(2);

        const client2Trees = repo.findByClient("c2");
        expect(client2Trees).toHaveLength(1);
    });

    it("deletes a specific tree", () => {
        repo.upsert("c1", "t1", mockNode, "hash1");
        repo.delete("c1", "t1");

        expect(repo.find("c1", "t1")).toBeUndefined();
    });

    it("deletes all trees for a client", () => {
        repo.upsert("c1", "t1", mockNode, "hash1");
        repo.upsert("c1", "t2", mockNode, "hash2");
        repo.upsert("c2", "t1", mockNode, "hash3");

        repo.deleteByClient("c1");

        expect(repo.findByClient("c1")).toHaveLength(0);
        expect(repo.findByClient("c2")).toHaveLength(1);
    });
});
