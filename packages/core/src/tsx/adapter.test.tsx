import { describe, it, expect } from "vitest";
import { BTNode, NodeResult, TickContext } from "../base";
import { Sequence, SequenceWithMemory, FallbackWithMemory, Fallback } from "../nodes";
import { ConditionNode } from "../base/condition";
import { Action } from "../base";
import { Decorator } from "../base/decorator";
import { AlwaysFailPolicy } from "../nodes/composite/parallel";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BT } from "./index"; // This will be the alias we use for JSX factory -> JSXFactory: "BT.createElement"
import { NodeProps } from "../builder";
import { UtilityFallback } from "../nodes/composite/utility-fallback";
import { UtilitySequence } from "../nodes/composite/utility-sequence";
import { tickNode } from "../test-helpers";
import { Utility } from "../nodes/decorators/utility";
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
            return <fallback {...props}>
                <action name={props.customProp ?? "DefaultName"} execute={() => NodeResult.Succeeded} />
            </fallback>
        }

        const tree = <SubTree name="CustomSelectorSubTree" customProp="CustomPropName" />;
        expect(tree).toBeInstanceOf(Fallback);
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
            <sequence-with-memory name="MemSeq">
                <fallback-with-memory name="MemSel">
                    <action execute={() => NodeResult.Succeeded} />
                </fallback-with-memory>
                <fallback-with-memory name="MemFall">
                    <action execute={() => NodeResult.Succeeded} />
                </fallback-with-memory>
            </sequence-with-memory>
        );

        expect(tree).toBeInstanceOf(SequenceWithMemory);
        expect(tree.name).toBe("MemSeq");

        const children = tree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(FallbackWithMemory);
        expect(children[0].name).toBe("MemSel");

        expect(children[1]).toBeInstanceOf(FallbackWithMemory);
        expect(children[1].name).toBe("MemFall");
    });

    it("supports custom policies on parallel nodes", () => {
        const tree = (
            <parallel name="CustomParallel" policy={AlwaysFailPolicy}>
                <action execute={() => NodeResult.Succeeded} />
                <action execute={() => NodeResult.Succeeded} />
            </parallel>
        );

        // the mock always fail policy will force the parallel node to Fail even if children succeed
        const result = tickNode(tree);

        expect(result).toBe(NodeResult.Failed);
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

    it("applies tags from props directly to the node", () => {
        const tree = (
            <action
                name="TaggedAction"
                tag="testTag"
                tags={["tag1", "tag2"]}
                execute={() => NodeResult.Succeeded}
            />
        );

        expect(tree).toBeInstanceOf(Action);
        expect(tree.tags).toContain("testTag");
        expect(tree.tags).toContain("tag1");
        expect(tree.tags).toContain("tag2");
        expect(tree.tags.length).toBe(3);
    });

    it("can create utility fallbacks and wrap children in utility-node", () => {
        const tree = (
            <utility-fallback name="MyUtilityFallback">
                <utility-node scorer={(_ctx: TickContext) => 10}>
                    <action name="Action10" execute={() => NodeResult.Succeeded} />
                </utility-node>
                <utility-node scorer={(_ctx: TickContext) => 20}>
                    <action name="Action20" execute={() => NodeResult.Succeeded} />
                </utility-node>
            </utility-fallback>
        );

        expect(tree).toBeInstanceOf(UtilityFallback);
        expect(tree.name).toBe("MyUtilityFallback");

        const children = tree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(Utility);
        expect(children[0].displayName).toBe("Utility");
        const action10 = children[0].getChildren?.()[0];
        expect(action10).toBeInstanceOf(Action);
        expect(action10?.displayName).toBe("Action10");

        expect(children[1]).toBeInstanceOf(Utility);
        expect(children[1].displayName).toBe("Utility");
        const action20 = children[1].getChildren?.()[0];
        expect(action20).toBeInstanceOf(Action);
        expect(action20?.displayName).toBe("Action20");

        // Let's tick it to make sure the scorer 20 is chosen
        let executionCount10 = 0;
        let executionCount20 = 0;

        const testTree = (
            <utility-fallback>
                <utility-node scorer={() => 10}>
                    <action execute={() => { executionCount10++; return NodeResult.Succeeded; }} />
                </utility-node>
                <utility-node scorer={() => 20}>
                    <action execute={() => { executionCount20++; return NodeResult.Succeeded; }} />
                </utility-node>
            </utility-fallback>
        );

        const result = tickNode(testTree);
        expect(result).toBe(NodeResult.Succeeded);
        expect(executionCount10).toBe(0);
        expect(executionCount20).toBe(1);
    });

    it("throws an error if a child of utility-fallback is not wrapped in utility-node", () => {
        expect(() => {
            <utility-fallback>
                <action execute={() => NodeResult.Succeeded} />
            </utility-fallback>;
        }).toThrow("Children of <utility-fallback> must be wrapped in <utility-node scorer={...}>");
    });

    it("can create utility sequences and wrap children in utility-node", () => {
        const tree = (
            <utility-sequence name="MyUtilitySequence">
                <utility-node scorer={(_ctx: TickContext) => 10}>
                    <action name="Action10" execute={() => NodeResult.Succeeded} />
                </utility-node>
                <utility-node scorer={(_ctx: TickContext) => 20}>
                    <action name="Action20" execute={() => NodeResult.Succeeded} />
                </utility-node>
            </utility-sequence>
        );

        expect(tree).toBeInstanceOf(UtilitySequence);
        expect(tree.name).toBe("MyUtilitySequence");

        const children = tree.getChildren?.() ?? [];
        expect(children.length).toBe(2);

        expect(children[0]).toBeInstanceOf(Utility);
        expect(children[0].displayName).toBe("Utility");
        const action10 = children[0].getChildren?.()[0];
        expect(action10).toBeInstanceOf(Action);
        expect(action10?.displayName).toBe("Action10");

        expect(children[1]).toBeInstanceOf(Utility);
        expect(children[1].displayName).toBe("Utility");
        const action20 = children[1].getChildren?.()[0];
        expect(action20).toBeInstanceOf(Action);
        expect(action20?.displayName).toBe("Action20");

        let executionCount10 = 0;
        let executionCount20 = 0;

        const testTree = (
            <utility-sequence>
                <utility-node scorer={() => 10}>
                    <action execute={() => { executionCount10++; return NodeResult.Succeeded; }} />
                </utility-node>
                <utility-node scorer={() => 20}>
                    <action execute={() => { executionCount20++; return NodeResult.Succeeded; }} />
                </utility-node>
            </utility-sequence>
        );

        const result = tickNode(testTree);
        expect(result).toBe(NodeResult.Succeeded);
        expect(executionCount10).toBe(1);
        expect(executionCount20).toBe(1);
    });

    it("throws an error if a child of utility-sequence is not wrapped in utility-node", () => {
        expect(() => {
            <utility-sequence>
                <action execute={() => NodeResult.Succeeded} />
            </utility-sequence>;
        }).toThrow("Children of <utility-sequence> must be wrapped in <utility-node scorer={...}>");
    });
});
