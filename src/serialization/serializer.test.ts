import { describe, it, expect } from "vitest";
import { BehaviourTree } from "../tree";
import { Action } from "../base/action";
import { Decorator } from "../base/decorator";
import { Composite } from "../base/composite";
import { NodeResult, NodeType, SerializableState, TickContext, BTNode } from "../base";

class MockAction extends Action {
    public override name = "MockAction";
    public customState = { active: false };

    protected override onTick(_ctx: TickContext): NodeResult {
        this.customState.active = true;
        return NodeResult.Running;
    }

    public override getDisplayState(): SerializableState {
        return this.customState;
    }
}

class MockDecorator extends Decorator {
    public override name = "MockDecorator";
    public customState = { counts: 0 };

    public override get displayName(): string {
        return `MockDecorator (${this.customState.counts})`;
    }

    protected override onTick(ctx: TickContext): NodeResult {
        this.customState.counts += 1;
        BTNode.Tick(this.child, ctx);
        return NodeResult.Running;
    }

    public override getDisplayState(): SerializableState {
        return this.customState;
    }
}

class MockSequence extends Composite {
    public readonly NODE_TYPE: NodeType = "Sequence"; // Lie about type for testing
    public override name = "MockSequence";

    constructor(children: BTNode[]) {
        super();
        children.forEach(c => this.addNode(c));
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length > 0) {
            BTNode.Tick(this.nodes[0], ctx);
        }
        return NodeResult.Running;
    }
}

describe("Serialization", () => {
    it("serializes an unexplored tree structure correctly", () => {
        const action = new MockAction();
        const decorator = new MockDecorator(action);
        const composite = new MockSequence([decorator]);
        const tree = new BehaviourTree(composite);

        const serialized = tree.serialize();

        expect(serialized).toMatchObject({
            id: expect.any(Number),
            type: "Sequence",
            displayName: "MockSequence",
            children: [{
                id: expect.any(Number),
                type: "Decorator",
                displayName: "MockDecorator (0)",
                state: {
                    counts: 0
                },
                children: [{
                    id: expect.any(Number),
                    type: "Action",
                    displayName: "MockAction",
                    state: {
                        active: false
                    }
                }]
            }]
        });
    });

    it("serializes tree with active state correctly after ticking", () => {
        const action = new MockAction();
        const decorator = new MockDecorator(action);
        const composite = new MockSequence([decorator]);
        const tree = new BehaviourTree(composite);

        tree.tick();
        const serialized = tree.serialize();

        const serializedDecorator = serialized.children![0];
        const serializedAction = serializedDecorator.children![0];
        expect(serializedDecorator).toMatchObject({
            displayName: "MockDecorator (1)",
            state: { counts: 1 }
        });
        expect(serializedAction.state).toMatchObject({
            active: true
        });
    });
});
