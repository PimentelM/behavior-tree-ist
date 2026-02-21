import { describe, it, expect } from "vitest";
import { Parallel, SuccessThresholdParallelPolicy, AlwaysRunningParallelPolicy } from "./parallel";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Parallel", () => {
    it("ticks all children regardless of results", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2, child3]);

        BTNode.Tick(parallel, createTickContext());

        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
        expect(child3.tickCount).toBe(1);
    });

    it("DefaultParallelPolicy always returns Succeeded", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2]);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("SuccessThresholdParallelPolicy succeeds when success+running >= threshold", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const child3 = new StubAction(NodeResult.Failed);
        const policy = new SuccessThresholdParallelPolicy(2);
        const parallel = Parallel.from("test", [child1, child2, child3], policy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("SuccessThresholdParallelPolicy fails when success+running < threshold", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);
        const child3 = new StubAction(NodeResult.Succeeded);
        const policy = new SuccessThresholdParallelPolicy(3);
        const parallel = Parallel.from("test", [child1, child2, child3], policy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("AlwaysRunningParallelPolicy always returns Running", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const parallel = Parallel.from("test", [child1, child2], AlwaysRunningParallelPolicy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("throws when no children", () => {
        const parallel = Parallel.from("test", []);

        expect(() => BTNode.Tick(parallel, createTickContext())).toThrow("has no nodes");
    });

    it("from factory works without name", () => {
        const parallel = Parallel.from([new StubAction()]);

        expect(parallel.nodes).toHaveLength(1);
    });
});
