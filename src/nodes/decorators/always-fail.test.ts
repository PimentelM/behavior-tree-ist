import { describe, it, expect } from "vitest";
import { AlwaysFail } from "./always-fail";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("AlwaysFail", () => {
    it("converts Succeeded to Failed", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const decorator = new AlwaysFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("keeps Failed as Failed", () => {
        const child = new StubAction(NodeResult.Failed);
        const decorator = new AlwaysFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("passes through Running unchanged", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new AlwaysFail(child);

        const result = BTNode.Tick(decorator, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });
});
