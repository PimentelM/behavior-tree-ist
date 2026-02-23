import { describe, it, expect } from "vitest";
import { buildSubtree } from "./subtree-builder";
import { BTNode } from "./base/node";
import { NodeResult } from "./base/types";
import { StubAction, createTickContext } from "./test-helpers";
import { Selector } from "./nodes/composite/selector";
import { Sequence } from "./nodes/composite/sequence";
import { Parallel } from "./nodes/composite/parallel";
import { ConditionNode } from "./base/condition";
import { Action } from "./base";

describe("buildSubtree", () => {
    it("passes through BTNode instances unchanged", () => {
        const node = new StubAction(NodeResult.Succeeded);

        const result = buildSubtree(node);

        expect(result).toBe(node);
    });

    it("builds a condition from blueprint", () => {
        const node = buildSubtree(["condition", "isReady", () => true]);
        const ctx = createTickContext();

        const result = BTNode.Tick(node, ctx);

        expect(result).toBe(NodeResult.Succeeded);
        expect(node.name).toBe("isReady");
        expect(node).toBeInstanceOf(ConditionNode);
    });

    it("builds an action from blueprint", () => {
        const node = buildSubtree(["action", "doStuff", () => NodeResult.Running]);
        const ctx = createTickContext();

        const result = BTNode.Tick(node, ctx);

        expect(result).toBe(NodeResult.Running);
        expect(node.name).toBe("doStuff");
        expect(node).toBeInstanceOf(Action);
    });

    it("builds a sequence from blueprint", () => {
        const node = buildSubtree([
            "sequence", "mySeq",
            ["action", "a1", () => NodeResult.Succeeded],
            ["action", "a2", () => NodeResult.Succeeded],
        ]);

        const result = BTNode.Tick(node, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(node).toBeInstanceOf(Sequence);
    });

    it("builds a selector from blueprint", () => {
        const node = buildSubtree([
            "selector", "mySel",
            ["action", "a1", () => NodeResult.Failed],
            ["action", "a2", () => NodeResult.Succeeded],
        ]);

        const result = BTNode.Tick(node, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(node).toBeInstanceOf(Selector);
    });

    it("builds a parallel from blueprint", () => {
        const node = buildSubtree([
            "parallel", "myPar",
            ["action", "a1", () => NodeResult.Succeeded],
            ["action", "a2", () => NodeResult.Succeeded],
        ]);

        const result = BTNode.Tick(node, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
        expect(node).toBeInstanceOf(Parallel);
    });

    it("handles deep nesting", () => {
        const node = buildSubtree([
            "selector", "root",
            ["sequence", "branch1",
                ["condition", "check", () => false],
                ["action", "unreachable", () => NodeResult.Succeeded],
            ],
            ["action", "fallback", () => NodeResult.Succeeded],
        ]);

        const result = BTNode.Tick(node, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("throws for unknown type with leaf args", () => {
        expect(() =>
            // @ts-expect-error testing invalid type
            buildSubtree(["unknown", "test", () => true])
        ).toThrow("Unknown node type: unknown");
    });

    it("throws for unknown type with composite args", () => {
        const blueprint = ["unknown", "test", ["action", "child", () => NodeResult.Succeeded]] as unknown as Parameters<typeof buildSubtree>[0];

        expect(() => buildSubtree(blueprint)).toThrow("Unknown node type: unknown");
    });
});
