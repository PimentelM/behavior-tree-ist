import { describe, it, expect } from "vitest";
import { Debounce } from "./debounce";
import { NodeResult } from "../../base";
import { StubAction } from "../../test-helpers";
import { BehaviourTree } from "../../tree";

describe("Debounce", () => {
    it("returns failed while debouncing success", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debounce = new Debounce(child, 100);
        const tree = new BehaviourTree(debounce).enableTrace();

        const events = tree.tick({ now: 0 }); // ticks child, returns Succeeded, debounces

        expect(events[events.length - 1].result).toBe(NodeResult.Failed);
    });

    it("returns succeeded after debounce expires with uninterrupted success", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debounce = new Debounce(child, 100);
        const tree = new BehaviourTree(debounce).enableTrace();

        tree.tick({ now: 0 }); // starts debouncing
        tree.tick({ now: 50 }); // still debouncing
        const events = tree.tick({ now: 100 }); // debounce met

        expect(events[events.length - 1].result).toBe(NodeResult.Succeeded);
    });

    it("resets debounce timer if child runs", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debounce = new Debounce(child, 100);
        const tree = new BehaviourTree(debounce).enableTrace();

        tree.tick({ now: 0 }); // starts debouncing

        child.nextResult = NodeResult.Running;
        tree.tick({ now: 50 }); // interrupts debounce

        child.nextResult = NodeResult.Succeeded;
        const events = tree.tick({ now: 100 }); // starts debouncing fresh

        expect(events[events.length - 1].result).toBe(NodeResult.Failed); // not met yet
    });

    it("works correctly when first success at tick 0", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debounce = new Debounce(child, 100);
        const tree = new BehaviourTree(debounce).enableTrace();

        // First success at now=0 — sentinel check must use === undefined, not falsy
        const e1 = tree.tick({ now: 0 });
        expect(e1[e1.length - 1].result).toBe(NodeResult.Failed); // debounced

        // Still within debounce window
        const e2 = tree.tick({ now: 50 });
        expect(e2[e2.length - 1].result).toBe(NodeResult.Failed); // still debounced

        // Exactly at debounce boundary — passes through
        const e3 = tree.tick({ now: 100 });
        expect(e3[e3.length - 1].result).toBe(NodeResult.Succeeded);
    });

    it("resets debounce timer if child fails", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const debounce = new Debounce(child, 100);
        const tree = new BehaviourTree(debounce).enableTrace();

        tree.tick({ now: 0 }); // starts debouncing

        child.nextResult = NodeResult.Failed;
        tree.tick({ now: 50 }); // interrupts debounce

        child.nextResult = NodeResult.Succeeded;
        const events = tree.tick({ now: 100 }); // starts debouncing fresh

        expect(events[events.length - 1].result).toBe(NodeResult.Failed); // not met yet
    });
});
