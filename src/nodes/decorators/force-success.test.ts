import { describe, it, expect } from "vitest";
import { ForceSuccess } from "./force-success";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("ForceSuccess", () => {
    it("converts Failed to Succeeded", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new ForceSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("keeps Succeeded as Succeeded", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new ForceSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("passes through Running unchanged", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new ForceSuccess(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });
});
