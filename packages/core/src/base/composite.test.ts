import { describe, it, expect } from "vitest";
import { Composite } from "./composite";
import { BTNode, TickContext } from "./node";
import { NodeResult } from "./types";
import { createNodeTicker, StubAction } from "../test-helpers";

class ConcreteComposite extends Composite {
    public override readonly defaultName = "Composite";
    public tickResult: NodeResult = NodeResult.Succeeded;
    public tickChildren: boolean = false;

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.tickChildren) {
            for (const node of this.nodes) {
                BTNode.Tick(node, ctx);
            }
        }
        return this.tickResult;
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

    it("onAbort aborts Running children when composite was Running", () => {
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Succeeded);
        const composite = new ConcreteComposite();
        composite.tickChildren = true;
        composite.tickResult = NodeResult.Running;
        composite.addNode(child1);
        composite.addNode(child2);
        const ticker = createNodeTicker();

        ticker.tick(composite);
        ticker.abort(composite);

        expect(child1.abortCount).toBe(1);
        expect(child2.abortCount).toBe(0);
    });

    it("abort is a no-op when composite was never Running", () => {
        const composite = new ConcreteComposite();
        const child1 = new StubAction();
        const child2 = new StubAction();
        composite.addNode(child1);
        composite.addNode(child2);
        const ticker = createNodeTicker();

        ticker.abort(composite);

        expect(child1.abortCount).toBe(0);
        expect(child2.abortCount).toBe(0);
    });
});
