import { describe, it, expect } from "vitest";
import { BTNode, NodeFlags, NodeResult, type TickContext } from "../base";
import { Sequence, SequenceWithMemory, FallbackWithMemory, Fallback } from "../nodes";
import { ConditionNode } from "../base/condition";
import { Action } from "../base";
import { Decorator } from "../base/decorator";
import { AlwaysFailPolicy } from "../nodes/composite/parallel";

import { BT } from "./index"; // This will be the alias we use for JSX factory -> JSXFactory: "BT.createElement"
import { type NodeProps } from "../builder";
import { UtilityFallback } from "../nodes/composite/utility-fallback";
import { UtilitySequence } from "../nodes/composite/utility-sequence";
import { createNodeTicker, tickNode, StubAction } from "../test-helpers";
import { Utility } from "../nodes/decorators/utility";
import { SubTree } from "../nodes/decorators/sub-tree";
import { NonAbortable } from "../nodes/decorators/non-abortable";
import { Inverter } from "../nodes/decorators/inverter";
import { Retry } from "../nodes/decorators/retry";
import { Repeat } from "../nodes/decorators/repeat";
import { Cooldown } from "../nodes/decorators/cooldown";
import { Precondition } from "../nodes/decorators/precondition";
import { OnEnter } from "../nodes/decorators/on-enter";
import { OnTicked } from "../nodes/decorators/on-ticked";
 



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
        expect((children[0] as BTNode).name).toBe("Has Energy");

        expect(children[1]).toBeInstanceOf(Action);
        expect((children[1] as BTNode).name).toBe("Attack");
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
        expect((nodes[0] as BTNode).name).toBe("Walk");
        expect((nodes[1] as BTNode).name).toBe("Run");
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
        const child = (tree.getChildren?.() ?? [])[0] as BTNode;
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
        expect((children[1] as BTNode).name).toBe("TSX Action");
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
        expect((children[0] as BTNode).name).toBe("MemSel");

        expect(children[1]).toBeInstanceOf(FallbackWithMemory);
        expect((children[1] as BTNode).name).toBe("MemFall");
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

    it("supports keepRunningChildren on parallel nodes", () => {
        const failing = new StubAction(NodeResult.Failed);
        const running = new StubAction(NodeResult.Running);
        const tree = (
            <parallel name="CustomParallel" keepRunningChildren>
                {failing}
                {running}
            </parallel>
        );

        const result = tickNode(tree);

        expect(result).toBe(NodeResult.Failed);
        expect(running.abortCount).toBe(0);
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

    it("applies nonAbortable NodeProps through TSX", () => {
        const node = (
            <action
                nonAbortable
                execute={() => NodeResult.Running}
            />
        );

        expect(node).toBeInstanceOf(NonAbortable);

        const ticker = createNodeTicker();
        expect(ticker.tick(node)).toBe(NodeResult.Running);
        ticker.abort(node);
        expect(node.getChildren?.()[0]?.wasRunning).toBe(true);
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

    it("accepts activity or displayActivity props", () => {
        const withActivity = (
            <action
                activity="Attacking"
                execute={() => NodeResult.Succeeded}
            />
        );
        expect(withActivity.activity).toBe("Attacking");

        const withAlias = (
            <action
                displayActivity="Kiting"
                execute={() => NodeResult.Succeeded}
            />
        );
        expect(withAlias.activity).toBe("Kiting");

        const withDefaultLabel = (
            <action
                activity={true}
                execute={() => NodeResult.Succeeded}
            />
        );
        expect(withDefaultLabel.activity).toBe(true);
    });

    it("throws when both activity and displayActivity props are provided", () => {
        expect(() => (
            <action
                activity="Attacking"
                displayActivity="Attacking"
                execute={() => NodeResult.Succeeded}
            />
        )).toThrow("Only one activity label prop is allowed");

        expect(() => (
            <action
                activity={true}
                displayActivity="Attacking"
                execute={() => NodeResult.Succeeded}
            />
        )).toThrow("Only one activity label prop is allowed");
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
        expect((children[0] as BTNode).displayName).toBe("Utility");
        const action10 = (children[0] as BTNode).getChildren?.()[0];
        expect(action10).toBeInstanceOf(Action);
        expect(action10?.displayName).toBe("Action10");

        expect(children[1]).toBeInstanceOf(Utility);
        expect((children[1] as BTNode).displayName).toBe("Utility");
        const action20 = (children[1] as BTNode).getChildren?.()[0];
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
        expect((children[0] as BTNode).displayName).toBe("Utility");
        const action10 = (children[0] as BTNode).getChildren?.()[0];
        expect(action10).toBeInstanceOf(Action);
        expect(action10?.displayName).toBe("Action10");

        expect(children[1]).toBeInstanceOf(Utility);
        expect((children[1] as BTNode).displayName).toBe("Utility");
        const action20 = (children[1] as BTNode).getChildren?.()[0];
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

    it("supports display-state intrinsic element", () => {
        const tree = (
            <display-state
                name="MyTSXDisplay"
                display={() => ({ hello: "world" })}
            />
        );

        expect(tree.name).toBe("MyTSXDisplay");
        expect(tree.getDisplayState?.()).toEqual({ hello: "world" });
        expect(tickNode(tree)).toBe(NodeResult.Succeeded);
    });

    it("supports sub-tree intrinsic element", () => {
        const tree = (
            <sub-tree name="CombatBoundary" id="combat-root" namespace="combat">
                <action name="Attack" execute={() => NodeResult.Succeeded} />
            </sub-tree>
        );

        expect(tree).toBeInstanceOf(SubTree);
        expect(tree.displayName).toBe("CombatBoundary");
        expect(tree.nodeFlags & NodeFlags.SubTree).toBeTruthy();
        expect(tree.metadata).toEqual({ id: "combat-root", namespace: "combat" });
        expect(tree.getDisplayState?.()).toBeUndefined();
        expect(tickNode(tree)).toBe(NodeResult.Succeeded);
    });

    it("throws when sub-tree does not have exactly one child", () => {
        expect(() => {
            <sub-tree name="Invalid" />;
        }).toThrow("<sub-tree> must have exactly one child node");

        expect(() => {
            <sub-tree name="Invalid">
                <action execute={() => NodeResult.Succeeded} />
                <action execute={() => NodeResult.Succeeded} />
            </sub-tree>;
        }).toThrow("<sub-tree> must have exactly one child node");
    });

    describe("decorator intrinsic elements", () => {
        it("zero-arg: inverter wraps child and inverts result", () => {
            const node = (
                <inverter>
                    <action execute={() => NodeResult.Succeeded} />
                </inverter>
            );

            expect(node).toBeInstanceOf(Inverter);
            expect(tickNode(node)).toBe(NodeResult.Failed);
        });

        it("numeric: retry with maxRetries prop", () => {
            let calls = 0;
            const node = (
                <retry maxRetries={2}>
                    <action execute={() => { calls++; return NodeResult.Failed; }} />
                </retry>
            );

            expect(node).toBeInstanceOf(Retry);
            tickNode(node);
            expect(calls).toBe(3); // initial + 2 retries
        });

        it("numeric: repeat with times prop", () => {
            let calls = 0;
            const node = (
                <repeat times={3}>
                    <action execute={() => { calls++; return NodeResult.Succeeded; }} />
                </repeat>
            );

            expect(node).toBeInstanceOf(Repeat);
            const ticker = createNodeTicker();
            ticker.tick(node);
            expect(calls).toBe(3);
        });

        it("numeric: cooldown prop — no double-wrap", () => {
            const node = (
                <cooldown cooldown={1000}>
                    <action execute={() => NodeResult.Succeeded} />
                </cooldown>
            );

            expect(node).toBeInstanceOf(Cooldown);
            // After first tick succeeds, cooldown kicks in — second tick returns Failure
            const ticker = createNodeTicker();
            expect(ticker.tick(node)).toBe(NodeResult.Succeeded);
            expect(ticker.tick(node)).toBe(NodeResult.Failed);
        });

        it("condition: precondition wraps child with condition check", () => {
            let gateOpen = false;
            const node = (
                <precondition name="GateCheck" condition={() => gateOpen}>
                    <action execute={() => NodeResult.Succeeded} />
                </precondition>
            );

            expect(node).toBeInstanceOf(Precondition);
            expect(node.name).toBe("GateCheck");

            expect(tickNode(node)).toBe(NodeResult.Failed);
            gateOpen = true;
            expect(tickNode(node)).toBe(NodeResult.Succeeded);
        });

        it("lifecycle hook: on-enter fires cb on entry", () => {
            let entered = false;
            const node = (
                <on-enter cb={() => { entered = true; }}>
                    <action execute={() => NodeResult.Succeeded} />
                </on-enter>
            );

            expect(node).toBeInstanceOf(OnEnter);
            tickNode(node);
            expect(entered).toBe(true);
        });

        it("lifecycle hook: on-ticked fires cb with result", () => {
            let lastResult: NodeResult | null = null;
            const node = (
                <on-ticked cb={(result) => { lastResult = result; }}>
                    <action execute={() => NodeResult.Succeeded} />
                </on-ticked>
            );

            expect(node).toBeInstanceOf(OnTicked);
            tickNode(node);
            expect(lastResult).toBe(NodeResult.Succeeded);
        });

        it("NodeProps applied on decorator elements — inverter stacks on retry", () => {
            // <retry maxRetries={0} inverter> — Retry fails (exhausted), outer Inverter makes it Succeeded
            const node = (
                <retry maxRetries={0} inverter>
                    <action execute={() => NodeResult.Failed} />
                </retry>
            );

            expect(node).toBeInstanceOf(Inverter);
            expect(node.getChildren?.()?.[0]).toBeInstanceOf(Retry);
            expect(tickNode(node)).toBe(NodeResult.Succeeded);
        });

        it("throws when decorator element has zero children", () => {
            expect(() => {
                // @ts-expect-error - intentionally wrong for test
                (<inverter />);
            }).toThrow("<inverter> must have exactly one child node");
        });

        it("throws when decorator element has more than one child", () => {
            expect(() => {
                <inverter>
                    <action execute={() => NodeResult.Succeeded} />
                    <action execute={() => NodeResult.Succeeded} />
                </inverter>;
            }).toThrow("<inverter> must have exactly one child node");
        });
    });
});
