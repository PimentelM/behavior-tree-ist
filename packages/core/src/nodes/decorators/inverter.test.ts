import { describe, it, expect } from "vitest";
import { Inverter } from "./inverter";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Inverter", () => {
    it("converts Succeeded to Failed", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const inverter = new Inverter(child);

        const result = BTNode.Tick(inverter, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("converts Failed to Succeeded", () => {
        const child = new StubAction(NodeResult.Failed);
        const inverter = new Inverter(child);

        const result = BTNode.Tick(inverter, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("passes through Running unchanged", () => {
        const child = new StubAction(NodeResult.Running);
        const inverter = new Inverter(child);

        const result = BTNode.Tick(inverter, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });
});
