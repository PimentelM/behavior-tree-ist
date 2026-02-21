import { describe, it, expect } from "vitest";
import { Composite } from "./composite";
import { BTNode } from "./node";
import { NodeResult, NodeType } from "./types";
import { createTickContext, StubAction } from "../test-helpers";

class ConcreteComposite extends Composite {
    public readonly NODE_TYPE: NodeType = "Composite";

    protected override onTick(): NodeResult {
        return NodeResult.Succeeded;
    }
}

describe("Composite", () => {
    it("addNode adds a child node", () => {
        const composite = new ConcreteComposite();
        const child = new StubAction();

        composite.addNode(child);

        expect(composite.nodes).toHaveLength(1);
        expect(composite.nodes[0]).toBe(child);
    });

    it("setNodes replaces all children", () => {
        const composite = new ConcreteComposite();
        const child1 = new StubAction();
        const child2 = new StubAction();
        composite.addNode(new StubAction());

        composite.setNodes([child1, child2]);

        expect(composite.nodes).toHaveLength(2);
        expect(composite.nodes[0]).toBe(child1);
        expect(composite.nodes[1]).toBe(child2);
    });

    it("clearNodes removes all children", () => {
        const composite = new ConcreteComposite();
        composite.addNode(new StubAction());
        composite.addNode(new StubAction());

        composite.clearNodes();

        expect(composite.nodes).toHaveLength(0);
    });

    it("onAbort aborts all children", () => {
        const composite = new ConcreteComposite();
        const child1 = new StubAction();
        const child2 = new StubAction();
        composite.addNode(child1);
        composite.addNode(child2);
        const ctx = createTickContext();

        BTNode.Abort(composite, ctx);

        expect(child1.abortCount).toBe(1);
        expect(child2.abortCount).toBe(1);
    });
});
