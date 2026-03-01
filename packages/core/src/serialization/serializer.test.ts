import { describe, it, expect } from "vitest";
import { BehaviourTree } from "../tree";
import { Action } from "../base/action";
import { Decorator } from "../base/decorator";
import { Composite } from "../base/composite";
import { NodeResult, NodeFlags, SerializableState, TickContext, BTNode } from "../base";
import { SubTree } from "../nodes/decorators/sub-tree";

class MockAction extends Action {
    public override readonly defaultName = "MockAction";
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
    public override readonly defaultName = "MockDecorator";
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
    public override readonly defaultName = "MockSequence";

    constructor(children: BTNode[]) {
        super();
        this.addFlags(NodeFlags.Sequence);
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
    it("serializes tree structure without state or displayName", () => {
        const action = new MockAction();
        action.addTags(["test-action"]);
        const decorator = new MockDecorator(action);
        const composite = new MockSequence([decorator]);
        composite.addTags(["test-composite"]);
        const tree = new BehaviourTree(composite);

        const serialized = tree.serialize();

        expect(serialized).toMatchObject({
            id: expect.any(Number),
            nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
            defaultName: "MockSequence",
            name: "",
            tags: ["test-composite"],
            children: [{
                id: expect.any(Number),
                nodeFlags: NodeFlags.Decorator,
                defaultName: "MockDecorator",
                name: "",
                children: [{
                    id: expect.any(Number),
                    nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                    defaultName: "MockAction",
                    name: "",
                    tags: ["test-action"],
                }]
            }]
        });

        // Verify state and displayName are NOT present
        expect(serialized).not.toHaveProperty("state");
        expect(serialized).not.toHaveProperty("displayName");
        expect(serialized.children![0]).not.toHaveProperty("state");
        expect(serialized.children![0]).not.toHaveProperty("displayName");
    });

    it("serialized tree does not change after ticking", () => {
        const action = new MockAction();
        const decorator = new MockDecorator(action);
        const composite = new MockSequence([decorator]);
        const tree = new BehaviourTree(composite);

        const beforeTick = tree.serialize();
        tree.tick();
        const afterTick = tree.serialize();

        // Structure should be identical — no state leaks into serialization
        expect(beforeTick).toEqual(afterTick);
    });

    it("serializes static metadata independently from includeState", () => {
        const boundary = new SubTree(new MockAction(), {
            id: "combat-root",
            namespace: "combat",
        });
        const tree = new BehaviourTree(boundary);

        const withoutState = tree.serialize();
        const withState = tree.serialize({ includeState: true });

        expect(withoutState.metadata).toEqual({
            id: "combat-root",
            namespace: "combat",
        });
        expect(withoutState.state).toBeUndefined();

        expect(withState.metadata).toEqual({
            id: "combat-root",
            namespace: "combat",
        });
    });

    describe('Options', () => {
        describe('include state', () => {
            it('includes state when enabled', () => {
                const action = new MockAction();
                action.addTags(["test-action"]);
                const decorator = new MockDecorator(action);
                const composite = new MockSequence([decorator]);
                composite.addTags(["test-composite"]);
                const tree = new BehaviourTree(composite);
                tree.tick();

                const serialized = tree.serialize({ includeState: true });

                expect(serialized).toMatchObject({
                    id: expect.any(Number),
                    nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
                    defaultName: "MockSequence",
                    name: "",
                    tags: ["test-composite"],
                    children: [{
                        id: expect.any(Number),
                        nodeFlags: NodeFlags.Decorator,
                        defaultName: "MockDecorator",
                        name: "",
                        state: {
                            counts: 1
                        },
                        children: [{
                            id: expect.any(Number),
                            nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                            defaultName: "MockAction",
                            name: "",
                            tags: ["test-action"],
                            state: {
                                active: true
                            }
                        }]
                    }]
                });
            })
        })
    })
});
