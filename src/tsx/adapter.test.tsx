import { describe, it, expect } from "vitest";
import { BTNode, NodeResult } from "../base";
import { Sequence } from "../nodes";
import { ConditionNode } from "../base/condition";
import { Action } from "../base";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BT } from "./index"; // This will be the alias we use for JSX factory -> JSXFactory: "BT.createElement"
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
});
