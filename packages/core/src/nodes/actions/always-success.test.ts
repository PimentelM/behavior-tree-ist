import { describe, it, expect } from "vitest";
import { AlwaysSuccess } from "./always-success";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext } from "../../test-helpers";

describe("AlwaysSuccess", () => {
    it("returns Succeeded on multiple ticks", () => {
        const action = new AlwaysSuccess();
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Succeeded);
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Succeeded);
        expect(BTNode.Tick(action, createTickContext())).toBe(NodeResult.Succeeded);
    });
});
