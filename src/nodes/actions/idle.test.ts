import { describe, it, expect } from "vitest";
import { IdleAction } from "./idle";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("IdleAction", () => {
    it("always returns Running across multiple ticks", () => {
        const idle = new IdleAction();
        const ctx = createTickContext();

        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
    });
});
