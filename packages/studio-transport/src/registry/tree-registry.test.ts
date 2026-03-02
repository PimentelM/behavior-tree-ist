import { describe, it, expect, vi } from "vitest";
import { TreeRegistry } from "./tree-registry";
import { BehaviourTree, Action, NodeResult } from "@behavior-tree-ist/core";

describe("TreeRegistry", () => {
    it("register with valid treeId succeeds, entry is retrievable", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        registry.register("tree-1", tree);

        const entry = registry.get("tree-1");
        expect(entry).toBeDefined();
        expect(entry?.treeId).toBe("tree-1");
        expect(entry?.tree).toBe(tree);
        expect(entry?.streaming).toBe(false);
    });

    it("register with invalid treeId throws", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        expect(() => registry.register("invalid name", tree)).toThrow(/Invalid treeId/);
    });

    it("register with duplicate treeId throws", () => {
        const registry = new TreeRegistry();
        const tree1 = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const tree2 = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        registry.register("tree-1", tree1);
        expect(() => registry.register("tree-1", tree2)).toThrow(/already registered/);
    });

    it("remove registered tree succeeds", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        registry.register("tree-1", tree);
        registry.remove("tree-1");

        expect(registry.get("tree-1")).toBeUndefined();
    });

    it("remove unregistered treeId throws", () => {
        const registry = new TreeRegistry();
        expect(() => registry.remove("not-found")).toThrow(/not registered/);
    });

    it("onTreeRegistered callback fires on register", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const handler = vi.fn();

        registry.onTreeRegistered(handler);
        registry.register("tree-1", tree);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ treeId: "tree-1" }));
    });

    it("onTreeRemoved callback fires on remove", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const handler = vi.fn();

        registry.register("tree-1", tree);
        registry.onTreeRemoved(handler);
        registry.remove("tree-1");

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith("tree-1");
    });

    it("onTick callback fires when reportTick() is called", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const handler = vi.fn();

        registry.register("tree-1", tree);
        registry.onTick(handler);

        const tickRecord = tree.tick({ now: Date.now() });
        registry.reportTick("tree-1", tickRecord);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith("tree-1", tickRecord);
    });

    it("useNowAsTickId() is called on the tree during registration", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const spy = vi.spyOn(tree, 'useNowAsTickId');

        registry.register("tree-1", tree);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("default streaming state is false", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        registry.register("tree-1", tree);
        expect(registry.isStreaming("tree-1")).toBe(false);
    });

    it("enableStreaming/disableStreaming toggles work", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        registry.register("tree-1", tree);

        registry.enableStreaming("tree-1");
        expect(registry.isStreaming("tree-1")).toBe(true);
        expect(registry.get("tree-1")?.streaming).toBe(true);

        registry.disableStreaming("tree-1");
        expect(registry.isStreaming("tree-1")).toBe(false);
        expect(registry.get("tree-1")?.streaming).toBe(false);
    });

    it("unsubscribe stops callbacks", () => {
        const registry = new TreeRegistry();
        const tree = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const handler = vi.fn();

        const unsub = registry.onTreeRegistered(handler);
        unsub();

        registry.register("tree-1", tree);
        expect(handler).not.toHaveBeenCalled();
    });

    it("getAll() returns all registered trees", () => {
        const registry = new TreeRegistry();
        const tree1 = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));
        const tree2 = new BehaviourTree(Action.from("Stub", () => NodeResult.Succeeded));

        registry.register("t1", tree1, { streaming: true });
        registry.register("t2", tree2);

        const all = registry.getAll();
        expect(all.size).toBe(2);
        expect(all.get("t1")?.streaming).toBe(true);
        expect(all.get("t2")?.streaming).toBe(false);
    });
});
