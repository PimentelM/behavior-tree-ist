import { describe, it, expect } from "vitest";
import { IfThenElse } from "./if-then-else";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("IfThenElse", () => {
    it("ticks 'then' when condition succeeds", () => {
        const condition = new StubAction(NodeResult.Succeeded);
        const thenBranch = new StubAction(NodeResult.Succeeded);
        const elseBranch = new StubAction(NodeResult.Failed);
        const ifThenElse = IfThenElse.from([condition, thenBranch, elseBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(condition.tickCount).toBe(1);
        expect(thenBranch.tickCount).toBe(1);
        expect(elseBranch.tickCount).toBe(0);
    });

    it("ticks 'else' when condition fails", () => {
        const condition = new StubAction(NodeResult.Failed);
        const thenBranch = new StubAction(NodeResult.Succeeded);
        const elseBranch = new StubAction(NodeResult.Succeeded);
        const ifThenElse = IfThenElse.from([condition, thenBranch, elseBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(condition.tickCount).toBe(1);
        expect(thenBranch.tickCount).toBe(0);
        expect(elseBranch.tickCount).toBe(1);
    });

    it("returns Failed when condition fails and no 'else'", () => {
        const condition = new StubAction(NodeResult.Failed);
        const thenBranch = new StubAction(NodeResult.Succeeded);
        const ifThenElse = IfThenElse.from([condition, thenBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(condition.tickCount).toBe(1);
        expect(thenBranch.tickCount).toBe(0);
    });

    it("returns Running when condition is Running", () => {
        const condition = new StubAction(NodeResult.Running);
        const thenBranch = new StubAction(NodeResult.Succeeded);
        const ifThenElse = IfThenElse.from([condition, thenBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Running);
        expect(condition.tickCount).toBe(1);
        expect(thenBranch.tickCount).toBe(0);
    });

    it("returns Running when 'then' returns Running", () => {
        const condition = new StubAction(NodeResult.Succeeded);
        const thenBranch = new StubAction(NodeResult.Running);
        const ifThenElse = IfThenElse.from([condition, thenBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("returns Running when 'else' returns Running", () => {
        const condition = new StubAction(NodeResult.Failed);
        const thenBranch = new StubAction(NodeResult.Succeeded);
        const elseBranch = new StubAction(NodeResult.Running);
        const ifThenElse = IfThenElse.from([condition, thenBranch, elseBranch]);

        const result = BTNode.Tick(ifThenElse, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("aborts 'then' and 'else' if condition is Running on subsequent tick", () => {
        const condition = new StubAction([NodeResult.Succeeded, NodeResult.Running]);
        const thenBranch = new StubAction(NodeResult.Running);
        const elseBranch = new StubAction(NodeResult.Running); // never ticked initially
        const ifThenElse = IfThenElse.from([condition, thenBranch, elseBranch]);

        BTNode.Tick(ifThenElse, createTickContext()); // Tick 1: condition succeeds, then is running
        BTNode.Tick(ifThenElse, createTickContext()); // Tick 2: condition returns running

        expect(thenBranch.abortCount).toBe(1);
        expect(elseBranch.abortCount).toBe(0);
    });

    it("aborts 'else' if condition goes from Failed to Succeeded", () => {
        const condition = new StubAction([NodeResult.Failed, NodeResult.Succeeded]);
        const thenBranch = new StubAction(NodeResult.Running);
        const elseBranch = new StubAction(NodeResult.Running);
        const ifThenElse = IfThenElse.from([condition, thenBranch, elseBranch]);

        BTNode.Tick(ifThenElse, createTickContext()); // Tick 1: condition fails, else is running
        BTNode.Tick(ifThenElse, createTickContext()); // Tick 2: condition succeeds, then is running

        expect(elseBranch.abortCount).toBe(1);
        expect(thenBranch.tickCount).toBe(1);
    });

    it("throws when less than 2 children", () => {
        const ifThenElse = new IfThenElse();
        ifThenElse.setNodes([new StubAction()]);

        expect(() => BTNode.Tick(ifThenElse, createTickContext())).toThrow("must have 2 or 3 children");
    });

    it("throws when more than 3 children", () => {
        const ifThenElse = new IfThenElse();
        ifThenElse.setNodes([new StubAction(), new StubAction(), new StubAction(), new StubAction()]);

        expect(() => BTNode.Tick(ifThenElse, createTickContext())).toThrow("must have 2 or 3 children");
    });
});
