import { describe, it, expect } from "vitest";
import { RequireSustainedSuccess } from "./require-sustained-success";
import { NodeResult } from "../../base";
import { StubAction } from "../../test-helpers";
import { BehaviourTree } from "../../tree";

describe("RequireSustainedSuccess", () => {
    it("returns failed until child node has succeeded for the required duration", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const requireSustainedSuccess = new RequireSustainedSuccess(child, 100);
        const tree = new BehaviourTree(requireSustainedSuccess).enableTrace();

        const { events } = tree.tick({ now: 0 }); // child is Succeeded, but duration not met

        expect(events[events.length - 1].result).toBe(NodeResult.Failed);
    });

    it("returns succeeded only after the child remains successful for the complete duration", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const requireSustainedSuccess = new RequireSustainedSuccess(child, 100);
        const tree = new BehaviourTree(requireSustainedSuccess).enableTrace();

        tree.tick({ now: 0 }); // first success
        tree.tick({ now: 50 }); // still succeeding, but duration not met
        const { events } = tree.tick({ now: 100 }); // strictly met duration

        expect(events[events.length - 1].result).toBe(NodeResult.Succeeded);
    });

    it("resets success timer and requires fresh sustained success if child returns Running", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const requireSustainedSuccess = new RequireSustainedSuccess(child, 100);
        const tree = new BehaviourTree(requireSustainedSuccess).enableTrace();

        tree.tick({ now: 0 }); // first success

        child.nextResult = NodeResult.Running;
        tree.tick({ now: 50 }); // interrupts success streak

        child.nextResult = NodeResult.Succeeded;
        const { events } = tree.tick({ now: 100 }); // starts requiring fresh

        expect(events[events.length - 1].result).toBe(NodeResult.Failed); // duration not met yet
    });

    it("works correctly when the first success occurs exactly at tick 0", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const requireSustainedSuccess = new RequireSustainedSuccess(child, 100);
        const tree = new BehaviourTree(requireSustainedSuccess).enableTrace();

        // First success at now=0
        const { events: e1 } = tree.tick({ now: 0 });
        expect(e1[e1.length - 1].result).toBe(NodeResult.Failed);

        const { events: e2 } = tree.tick({ now: 50 });
        expect(e2[e2.length - 1].result).toBe(NodeResult.Failed);

        const { events: e3 } = tree.tick({ now: 100 });
        expect(e3[e3.length - 1].result).toBe(NodeResult.Succeeded);
    });

    it("resets success timer and requires fresh sustained success if child returns Failed", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const requireSustainedSuccess = new RequireSustainedSuccess(child, 100);
        const tree = new BehaviourTree(requireSustainedSuccess).enableTrace();

        tree.tick({ now: 0 }); // first success

        child.nextResult = NodeResult.Failed;
        tree.tick({ now: 50 }); // interrupts success streak

        child.nextResult = NodeResult.Succeeded;
        const { events } = tree.tick({ now: 100 }); // starts requiring fresh

        expect(events[events.length - 1].result).toBe(NodeResult.Failed); // duration not met yet
    });
});
