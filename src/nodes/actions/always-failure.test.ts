import { describe, it, expect } from "vitest";
import { AlwaysFailure } from "./always-failure";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("AlwaysFailure", () => {
    it("returns Failed on multiple ticks", () => {
        const action = new AlwaysFailure();
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Failed);
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Failed);
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Failed);
    });
});
