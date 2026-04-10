import { describe, it, expect } from "vitest";
import { SkipOnFail } from "./skip-on-fail";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("SkipOnFail decorator", () => {
    it("returns Skipped when child returns Failed", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new SkipOnFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Skipped);
    });

    it("passes through Succeeded", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new SkipOnFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("passes through Running", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new SkipOnFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("passes through Skipped", () => {
        const child = new StubAction(NodeResult.Skipped);
        const decorator = new SkipOnFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Skipped);
    });
});
