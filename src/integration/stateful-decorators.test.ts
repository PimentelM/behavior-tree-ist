import { describe, it, expect } from "vitest";
import { BehaviourTree } from "../tree";
import { NodeResult } from "../base/types";
import { StubAction } from "../test-helpers";
import { Selector } from "../nodes/composite/selector";
import { Sequence } from "../nodes/composite/sequence";
import { Throttle } from "../nodes/decorators/throttle";
import { Timeout } from "../nodes/decorators/timeout";
import { WaitAction } from "../nodes/actions/wait";
import { ConditionNode } from "../base/condition";

describe("Stateful decorators in context", () => {
    describe("Throttle inside a Selector", () => {
        it("throttled branch is aborted when higher-priority branch succeeds", () => {
            // lowPriority must return Running for abort to be effective
            const highPriority = new StubAction([NodeResult.Failed, NodeResult.Succeeded]);
            const lowPriority = new StubAction(NodeResult.Running);
            const throttledLow = new Throttle(lowPriority, 1000);
            const selector = Selector.from([highPriority, throttledLow]);
            const tree = new BehaviourTree(selector);

            // Tick 1: highPriority fails, lowPriority Running through throttle
            tree.tick({ now: 5000 });

            // Tick 2: highPriority succeeds, throttledLow (which was Running) is aborted
            tree.tick({ now: 5100 });

            expect(lowPriority.abortCount).toBe(1);
        });

        it("resetOnAbort true restarts throttle after abort by selector", () => {
            // Throttle must be Running for abort to be effective
            const highPriority = new StubAction([NodeResult.Failed, NodeResult.Succeeded, NodeResult.Failed]);
            const lowPriority = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
            const throttledLow = new Throttle(lowPriority, 1000, { resetOnAbort: true });
            const selector = Selector.from([highPriority, throttledLow]);
            const tree = new BehaviourTree(selector);

            tree.tick({ now: 5000 });     // highPriority fails, throttle ticks child (Running)
            tree.tick({ now: 5100 });      // highPriority succeeds, throttle aborted+reset
            tree.tick({ now: 5200 });      // highPriority fails, throttle should tick child again (reset)

            expect(lowPriority.tickCount).toBe(2);
        });

        it("resetOnAbort false preserves throttle after abort by selector", () => {
            const highPriority = new StubAction([NodeResult.Failed, NodeResult.Succeeded, NodeResult.Failed]);
            const lowPriority = new StubAction(NodeResult.Succeeded);
            const throttledLow = new Throttle(lowPriority, 1000);
            const selector = Selector.from([highPriority, throttledLow]);
            const tree = new BehaviourTree(selector);

            tree.tick({ now: 5000 });     // highPriority fails, throttle ticks child
            tree.tick({ now: 5100 });      // highPriority succeeds, throttle aborted (not reset)
            tree.tick({ now: 5200 });      // highPriority fails, throttle still active -> Failed

            expect(lowPriority.tickCount).toBe(1);
        });
    });

    describe("Timeout wrapping a WaitAction", () => {
        it("timeout fires before wait completes, aborts and resets WaitAction", () => {
            const wait = new WaitAction(500);
            const timeout = new Timeout(wait, 200);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            tree.tick({ now: 100 });       // wait Running, timeout starts
            const events1 = tree.tick({ now: 300 });  // 200ms elapsed -> timeout fires, aborts wait

            expect(events1.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Failed);
        });

        it("wait completes before timeout when duration < timeout", () => {
            const wait = new WaitAction(100);
            const timeout = new Timeout(wait, 500);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            tree.tick({ now: 100 });
            const events = tree.tick({ now: 200 });

            expect(events.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Succeeded);
        });

        it("timeout resets on next execution after wait completes", () => {
            const wait = new WaitAction(100);
            const timeout = new Timeout(wait, 500);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            // First: wait completes
            tree.tick({ now: 100 });
            tree.tick({ now: 200 });

            // Second run: timeout should start fresh
            tree.tick({ now: 1000 });
            const events = tree.tick({ now: 1100 });

            expect(events.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Succeeded);
        });
    });

    describe("Throttle + Timeout stacked (Throttle(Timeout(child)))", () => {
        it("throttle prevents re-execution within window after timeout fires", () => {
            const child = new StubAction(NodeResult.Running);
            const timeout = new Timeout(child, 100);
            const throttle = new Throttle(timeout, 500);
            const tree = new BehaviourTree(throttle);

            tree.tick({ now: 5000 });      // child Running, timeout starts
            tree.tick({ now: 5100 });      // timeout fires -> Failed, throttle records

            // Within throttle window, throttle returns Failed without ticking timeout
            tree.tick({ now: 5200 });

            expect(child.tickCount).toBe(1);
        });

        it("throttle allows re-execution after window expires, timeout starts fresh", () => {
            const child = new StubAction(NodeResult.Running);
            const timeout = new Timeout(child, 100);
            const throttle = new Throttle(timeout, 500);
            const tree = new BehaviourTree(throttle);

            tree.tick({ now: 5000 });      // child Running
            tree.tick({ now: 5100 });      // timeout fires

            // After throttle window
            tree.tick({ now: 5600 });      // throttle allows, timeout starts fresh, child ticked

            expect(child.tickCount).toBe(2);
        });

        it("throttle bypasses rate-limit when child is Running (timeout has not fired)", () => {
            const child = new StubAction(NodeResult.Running);
            const timeout = new Timeout(child, 1000);
            const throttle = new Throttle(timeout, 500);
            const tree = new BehaviourTree(throttle);

            tree.tick({ now: 5000 });
            tree.tick({ now: 5050 });
            tree.tick({ now: 5100 });

            // All ticks should pass through since timeout returns Running
            expect(child.tickCount).toBe(3);
        });
    });

    describe("Throttle in a Sequence re-evaluated each tick", () => {
        it("throttle prevents action re-execution within window even as sequence re-evaluates", () => {
            const condition = ConditionNode.from("always", () => true);
            const action = new StubAction(NodeResult.Succeeded);
            const throttledAction = new Throttle(action, 1000);
            const sequence = Sequence.from([condition, throttledAction]);
            const tree = new BehaviourTree(sequence);
            tree.enableTrace();

            tree.tick({ now: 5000 });     // condition passes, action succeeds
            const events = tree.tick({ now: 5100 });  // condition passes, throttle -> Failed

            expect(events.find(e => e.nodeId === sequence.id)?.result).toBe(NodeResult.Failed);
        });

        it("throttle allows re-execution after window expires", () => {
            const condition = ConditionNode.from("always", () => true);
            const action = new StubAction(NodeResult.Succeeded);
            const throttledAction = new Throttle(action, 1000);
            const sequence = Sequence.from([condition, throttledAction]);
            const tree = new BehaviourTree(sequence);
            tree.enableTrace();

            tree.tick({ now: 5000 });
            const events = tree.tick({ now: 6000 });

            expect(events.find(e => e.nodeId === sequence.id)?.result).toBe(NodeResult.Succeeded);
            expect(action.tickCount).toBe(2);
        });

        it("sequence failing early does not affect throttle state", () => {
            let conditionResult = true;
            const condition = ConditionNode.from("toggle", () => conditionResult);
            const action = new StubAction(NodeResult.Succeeded);
            const throttledAction = new Throttle(action, 1000);
            const sequence = Sequence.from([condition, throttledAction]);
            const tree = new BehaviourTree(sequence);

            tree.tick({ now: 5000 });        // condition passes, action succeeds, throttle started
            conditionResult = false;
            tree.tick({ now: 5100 });         // condition fails, throttle not reached

            conditionResult = true;
            tree.tick({ now: 5500 });         // condition passes, but throttle still active -> Failed

            expect(action.tickCount).toBe(1);
        });
    });

    describe("Multiple Throttles in a Selector", () => {
        it("lower-priority throttled node ticks when higher-priority ones are throttled", () => {
            const action1 = new StubAction(NodeResult.Succeeded);
            const action2 = new StubAction(NodeResult.Succeeded);
            const throttle1 = new Throttle(action1, 1000);
            const throttle2 = new Throttle(action2, 500);
            const selector = Selector.from([throttle1, throttle2]);
            const tree = new BehaviourTree(selector);

            tree.tick({ now: 5000 });      // throttle1 ticks action1 (Succeeded)
            tree.tick({ now: 5500 });      // throttle1 still active -> Failed, throttle2 ticks action2

            expect(action1.tickCount).toBe(1);
            expect(action2.tickCount).toBe(1);
        });

        it("all branches throttled returns Failed from Selector", () => {
            const action1 = new StubAction(NodeResult.Failed);
            const action2 = new StubAction(NodeResult.Failed);
            const throttle1 = new Throttle(action1, 1000);
            const throttle2 = new Throttle(action2, 1000);
            const selector = Selector.from([throttle1, throttle2]);
            const tree = new BehaviourTree(selector);
            tree.enableTrace();

            // Both throttles tick (both children fail, selector sees all Failed)
            tree.tick({ now: 5000 });

            // Both throttled within window -> both return Failed -> selector Failed
            const events = tree.tick({ now: 5500 });

            expect(events.find(e => e.nodeId === selector.id)?.result).toBe(NodeResult.Failed);
        });

        it("throttle windows expire independently", () => {
            const action1 = new StubAction(NodeResult.Succeeded);
            const action2 = new StubAction(NodeResult.Succeeded);
            const throttle1 = new Throttle(action1, 1000);
            const throttle2 = new Throttle(action2, 500);
            const selector = Selector.from([throttle1, throttle2]);
            const tree = new BehaviourTree(selector);

            tree.tick({ now: 5000 });      // throttle1 ticks (succeeds)
            tree.tick({ now: 5500 });      // throttle1 active, throttle2 ticks (succeeds)
            tree.tick({ now: 6000 });      // throttle1 expires and ticks, throttle2 still active

            expect(action1.tickCount).toBe(2);
            expect(action2.tickCount).toBe(1);
        });
    });

    describe("Timeout with Running->Succeeded transition", () => {
        it("returns Succeeded when child completes before timeout", () => {
            const child = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
            const timeout = new Timeout(child, 1000);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            tree.tick({ now: 100 });
            const events = tree.tick({ now: 600 });

            expect(events.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Succeeded);
        });

        it("timer resets on next execution after child completed", () => {
            const child = new StubAction([
                NodeResult.Running, NodeResult.Succeeded,
                NodeResult.Running, NodeResult.Running,
            ]);
            const timeout = new Timeout(child, 100);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            tree.tick({ now: 100 });       // Running, timer starts at 100
            tree.tick({ now: 150 });       // Succeeded, timer resets
            tree.tick({ now: 1000 });      // Running, new timer starts at 1000
            const events = tree.tick({ now: 1050 }); // Running, 50ms elapsed (< 100ms)

            expect(events.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Running);
        });

        it("at exact timeout boundary, timeout fires first and returns Failed", () => {
            const child = new StubAction(NodeResult.Running);
            const timeout = new Timeout(child, 100);
            const tree = new BehaviourTree(timeout);
            tree.enableTrace();

            tree.tick({ now: 100 });
            const events = tree.tick({ now: 200 });

            expect(events.find(e => e.nodeId === timeout.id)?.result).toBe(NodeResult.Failed);
        });
    });
});
