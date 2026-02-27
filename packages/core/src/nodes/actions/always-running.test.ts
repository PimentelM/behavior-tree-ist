import { describe, it, expect } from "vitest";
import { AlwaysRunning } from "./always-running";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("AlwaysRunning", () => {
    it("always returns Running across multiple ticks", () => {
        const idle = new AlwaysRunning();
        const ctx = createTickContext();

        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
        expect(BTNode.Tick(idle, ctx)).toBe(NodeResult.Running);
    });
});
