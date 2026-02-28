import { describe, it, expect } from "vitest";
import { Parallel, SuccessThreshold, AlwaysRunningPolicy, AlwaysSucceedPolicy, AlwaysFailPolicy, FailThreshold, RequireOneSuccess } from "./parallel";
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

    it("DefaultParallelPolicy succeeds when all children succeed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const parallel = Parallel.from("test", [child1, child2]);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("DefaultParallelPolicy fails when any child fails", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const parallel = Parallel.from("test", [child1, child2]);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("DefaultParallelPolicy returns Running when any child is Running and none failed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2]);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts Running children when policy returns terminal result", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const child3 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2, child3]);

        BTNode.Tick(parallel, createTickContext());

        // DefaultParallelPolicy returns Failed when any child fails, so Running children should be aborted
        expect(child2.abortCount).toBe(1);
        expect(child3.abortCount).toBe(1);
        expect(child1.abortCount).toBe(0);
    });

    it("does not abort Running children when policy returns Running", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2], AlwaysRunningPolicy);

        BTNode.Tick(parallel, createTickContext());

        expect(child2.abortCount).toBe(0);
    });

    it("does not auto-abort Running children on terminal result when keepRunningChildren is true", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const child3 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2, child3], undefined, { keepRunningChildren: true });

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child2.abortCount).toBe(0);
        expect(child3.abortCount).toBe(0);
    });

    it("still propagates explicit parent abort even when keepRunningChildren is true", () => {
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2], undefined, { keepRunningChildren: true });

        BTNode.Tick(parallel, createTickContext());
        BTNode.Abort(parallel, createTickContext());

        expect(child1.abortCount).toBe(1);
        expect(child2.abortCount).toBe(1);
    });

    describe("RequireOneSuccess", () => {
        it("succeeds when at least one child succeeds", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Succeeded);
            const parallel = Parallel.from("test", [child1, child2], RequireOneSuccess);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Succeeded);
        });

        it("fails when all children fail", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Failed);
            const parallel = Parallel.from("test", [child1, child2], RequireOneSuccess);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Failed);
        });

        it("returns Running when no success yet but some are running", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Running);
            const parallel = Parallel.from("test", [child1, child2], RequireOneSuccess);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Running);
        });
    });

    describe("FailThreshold", () => {
        it("fails when actual failures meet threshold", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Failed);
            const child3 = new StubAction(NodeResult.Succeeded);
            const policy = FailThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Failed);
        });

        it("returns Running when threshold is still reachable but not yet met", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Running);
            const child3 = new StubAction(NodeResult.Succeeded);
            const policy = FailThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Running);
        });

        it("succeeds when threshold is impossible to meet", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Succeeded);
            const child3 = new StubAction(NodeResult.Failed);
            const policy = FailThreshold(3);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Succeeded);
        });

        it("aborts Running children when threshold is impossible to meet", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Succeeded);
            const child3 = new StubAction(NodeResult.Running);
            const policy = FailThreshold(3);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            BTNode.Tick(parallel, createTickContext());

            expect(child3.abortCount).toBe(1);
        });

        it("does not abort Running children when threshold is still reachable", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Running);
            const child3 = new StubAction(NodeResult.Running);
            const policy = FailThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            BTNode.Tick(parallel, createTickContext());

            expect(child2.abortCount).toBe(0);
            expect(child3.abortCount).toBe(0);
        });
    });

    describe("SuccessThreshold", () => {
        it("succeeds when actual successes meet threshold", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Succeeded);
            const child3 = new StubAction(NodeResult.Failed);
            const policy = SuccessThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Succeeded);
        });

        it("returns Running when threshold is still reachable but not yet met", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Running);
            const child3 = new StubAction(NodeResult.Failed);
            const policy = SuccessThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Running);
        });

        it("fails when threshold is impossible to meet", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Failed);
            const child3 = new StubAction(NodeResult.Succeeded);
            const policy = SuccessThreshold(3);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            const result = BTNode.Tick(parallel, createTickContext());

            expect(result).toBe(NodeResult.Failed);
        });

        it("aborts Running children when threshold is impossible to meet", () => {
            const child1 = new StubAction(NodeResult.Failed);
            const child2 = new StubAction(NodeResult.Failed);
            const child3 = new StubAction(NodeResult.Running);
            const policy = SuccessThreshold(3);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            BTNode.Tick(parallel, createTickContext());

            expect(child3.abortCount).toBe(1);
        });

        it("does not abort Running children when threshold is still reachable", () => {
            const child1 = new StubAction(NodeResult.Succeeded);
            const child2 = new StubAction(NodeResult.Running);
            const child3 = new StubAction(NodeResult.Running);
            const policy = SuccessThreshold(2);
            const parallel = Parallel.from("test", [child1, child2, child3], policy);

            BTNode.Tick(parallel, createTickContext());

            expect(child2.abortCount).toBe(0);
            expect(child3.abortCount).toBe(0);
        });
    });

    it("AlwaysRunningPolicy always returns Running", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const parallel = Parallel.from("test", [child1, child2], AlwaysRunningPolicy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("AlwaysSucceedPolicy always returns Succeeded", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2], AlwaysSucceedPolicy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("AlwaysFailPolicy always returns Failed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const parallel = Parallel.from("test", [child1, child2], AlwaysFailPolicy);

        const result = BTNode.Tick(parallel, createTickContext());

        expect(result).toBe(NodeResult.Failed);
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
