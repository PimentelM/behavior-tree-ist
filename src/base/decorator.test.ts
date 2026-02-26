import { describe, it, expect } from "vitest";
import { Decorator } from "./decorator";
import { BTNode } from "./node";
import { NodeResult } from "./types";
import { createNodeTicker, createTickContext, StubAction } from "../test-helpers";

class ConcreteDecorator extends Decorator {
    public override readonly defaultName = "Decorator";

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

    it("onAbort aborts a Running child", () => {
        const child = new StubAction(NodeResult.Running);
        const decorator = new ConcreteDecorator(child);
        const ticker = createNodeTicker();

        ticker.tick(decorator); // Make decorator and child Running
        ticker.abort(decorator);

        expect(child.abortCount).toBe(1);
    });

    it("abort is a no-op when decorator was never Running", () => {
        const child = new StubAction();
        const decorator = new ConcreteDecorator(child);
        const ticker = createNodeTicker();

        ticker.abort(decorator);

        expect(child.abortCount).toBe(0);
    });
});
