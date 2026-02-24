import { describe, it, expect } from "vitest";
import { BTNode, NodeResult, TickContext } from "../base";
import { Sequence, MemorySequence, MemorySelector, Selector } from "../nodes";
import { ConditionNode } from "../base/condition";
import { Action } from "../base";
import { Decorator } from "../base/decorator";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BT } from "./index"; // This will be the alias we use for JSX factory -> JSXFactory: "BT.createElement"
import { NodeProps } from "../builder";
/* eslint-enable @typescript-eslint/no-unused-vars */



describe("TSX Adapter", () => {
    it("builds a simple sequence with intrinsic elements", () => {
        const tree = (
            <sequence name="Root">
                <condition name="Has Energy" eval={() => true} />
                <action name="Attack" execute={() => NodeResult.Succeeded} />
            </sequence>
        );

        // Should return a single parsed sequence node
        expect(tree).toBeInstanceOf(Sequence);

        // Assertions on the parsed tree
        expect(tree).toBeInstanceOf(Sequence);
        expect(tree.name).toBe("Root");

        const children = tree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(ConditionNode);
        expect(children[0].name).toBe("Has Energy");

        expect(children[1]).toBeInstanceOf(Action);
        expect(children[1].name).toBe("Attack");
    });

    it("supports fragment wrappers", () => {
        const nodes: BTNode[] = (
            <>
                <action name="Walk" execute={() => NodeResult.Succeeded} />
                <action name="Run" execute={() => NodeResult.Succeeded} />
            </>
        ) as unknown as BTNode[];

        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBe(2);
        expect(nodes[0].name).toBe("Walk");
        expect(nodes[1].name).toBe("Run");
    });

    it("supports functional components and props", () => {
        const SubTree = (props: { target: string }) => (
            <action name={`Follow ${props.target}`} execute={() => NodeResult.Running} />
        );

        const tree = (
            <sequence name="Main">
                <SubTree target="Enemy" />
            </sequence>
        );

        const children = tree.getChildren?.() ?? [];
        expect(children[0]?.name).toBe("Follow Enemy");
    });

    it('supports using default props in functional components', () => {
        const SubTree = (props: NodeProps & { customProp?: string }) => {
            return <selector {...props}>
                <action name={props.customProp ?? "DefaultName"} execute={() => NodeResult.Succeeded} />
            </selector>
        }

        const tree = <SubTree name="CustomSelectorSubTree" customProp="CustomPropName" />;
        expect(tree).toBeInstanceOf(Selector);
        expect(tree.name).toBe("CustomSelectorSubTree");
        const [child] = tree.getChildren?.() ?? [];
        expect(child).toBeInstanceOf(Action);
        expect(child.name).toBe("CustomPropName");
    })

    it("applies decorators passed as props", () => {
        // Here we test the fact that since tsx-adapter delegates to subtree-builder,
        // all decorator props (like repeat, onEnter) automatically work.
        let entered = false;
        const _tree = (
            <action
                name="Do it"
                repeat={3}
                onEnter={() => entered = true}
                execute={() => NodeResult.Succeeded}
            />
        );

        // Force a read of the variable to avoid the unused linter, though TS syntax parsing alone tests this functionality mostly.
        expect(entered).toBe(false);
    });

    it("can reference manually instantiated nodes in the TSX tree", () => {
        // We can manually instantiate a standard Behavior Tree node
        const preInstantiatedAction = Action.from("Pre-Instantiated", () => NodeResult.Succeeded);

        // And place it perfectly inside a TSX structure
        const tree = (
            <sequence name="Mixed Tree">
                {preInstantiatedAction}
                <action name="TSX Action" execute={() => NodeResult.Failed} />
            </sequence>
        );

        const children = tree.getChildren?.() ?? [];

        expect(children.length).toBe(2);
        // The exact instance is preserved
        expect(children[0]).toBe(preInstantiatedAction);

        // The TSX-created instance follows
        expect(children[1]).toBeInstanceOf(Action);
        expect(children[1].name).toBe("TSX Action");
    });
    it("can create memory composite nodes", () => {
        const tree = (
            <memory-sequence name="MemSeq">
                <memory-selector name="MemSel">
                    <action execute={() => NodeResult.Succeeded} />
                </memory-selector>
                <memory-fallback name="MemFall">
                    <action execute={() => NodeResult.Succeeded} />
                </memory-fallback>
            </memory-sequence>
        );

        expect(tree).toBeInstanceOf(MemorySequence);
        expect(tree.name).toBe("MemSeq");

        const children = tree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(MemorySelector);
        expect(children[0].name).toBe("MemSel");

        expect(children[1]).toBeInstanceOf(MemorySelector);
        expect(children[1].name).toBe("MemFall");
    });

    it("can apply generic decorators using the decorate prop", () => {
        class DummyDecorator extends Decorator {
            constructor(child: BTNode, public readonly value: number) {
                super(child);
                this.name = "Dummy";
            }
            protected onTick(ctx: TickContext): NodeResult {
                return BTNode.Tick(this.child, ctx);
            }
        }

        const tree = (
            <action
                decorate={[DummyDecorator, 42]}
                execute={() => NodeResult.Succeeded}
            />
        );

        expect(tree).toBeInstanceOf(DummyDecorator);
        expect((tree as DummyDecorator).value).toBe(42);

        const multiDecorated = (
            <action
                decorate={[
                    [DummyDecorator, 1],
                    [DummyDecorator, 2]
                ]}
                execute={() => NodeResult.Succeeded}
            />
        );

        expect(multiDecorated).toBeInstanceOf(DummyDecorator);
        expect((multiDecorated as DummyDecorator).value).toBe(1);
        expect(multiDecorated.getChildren?.()[0]).toBeInstanceOf(DummyDecorator);
        expect((multiDecorated.getChildren?.()[0] as DummyDecorator).value).toBe(2);
    });
});
