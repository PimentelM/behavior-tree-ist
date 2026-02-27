import { describe, it, expect } from "vitest";
import { createHeroSubtree } from "./tsx-interop-fixture";
import { Sequence } from "../nodes";
import { ConditionNode } from "../base/condition";
import { Action, NodeResult } from "../base";
import { tickNode } from "../test-helpers";

describe("TSX Interop", () => {
    it("successfully imports and ticks a TSX-defined subtree inside a standard TS file", () => {
        // We import the TSX factory from standard TypeScript and execute it
        const subtree = createHeroSubtree("Paladin");

        // 1. Verify structure
        expect(subtree).toBeInstanceOf(Sequence);
        expect(subtree.name).toBe("Paladin Subtree");

        const children = subtree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(ConditionNode);
        expect(children[0].name).toBe("Is Alive");

        expect(children[1]).toBeInstanceOf(Action);
        expect(children[1].name).toBe("Attack");

        // 2. Verify runtime execution behaves correctly
        const result = tickNode(subtree);
        expect(result).toBe(NodeResult.Succeeded);
    });
});
