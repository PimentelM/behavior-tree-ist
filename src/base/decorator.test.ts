import { describe, it, expect } from "vitest";
import { Decorator } from "./decorator";
import { BTNode } from "./node";
import { NodeResult, NodeType } from "./types";
import { createTickContext, StubAction } from "../test-helpers";

class ConcreteDecorator extends Decorator {
    public readonly NODE_TYPE: NodeType = "Decorator";

    protected override onTick(): NodeResult {
        return BTNode.Tick(this.child, createTickContext());
    }
}

describe("Decorator", () => {
    it("stores the child node", () => {
        const child = new StubAction();

        const decorator = new ConcreteDecorator(child);

        expect(decorator.child).toBe(child);
    });

    it("onAbort aborts the child", () => {
        const child = new StubAction();
        const decorator = new ConcreteDecorator(child);
        const ctx = createTickContext();

        BTNode.Abort(decorator, ctx);

        expect(child.abortCount).toBe(1);
    });
});
