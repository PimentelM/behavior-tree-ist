import { describe, it, expect } from "vitest";
import { BTNode } from "./node";
import { NodeResult, NodeFlags } from "./types";
import { createTickContext, StubAction } from "../test-helpers";
import { Inverter } from "../nodes/decorators/inverter";
import { ForceSuccess } from "../nodes/decorators/force-success";

class ConcreteNode extends BTNode {
    public readonly defaultName = "Action";
    public result: NodeResult = NodeResult.Succeeded;

    constructor(name?: string) {
        super(name);
        this.addFlags(NodeFlags.Leaf, NodeFlags.Action);
    }

    public tickedResults: NodeResult[] = [];
    public successCallCount = 0;
    public failedCallCount = 0;
    public finishedResults: NodeResult[] = [];
    public abortCallCount = 0;
    public resetCallCount = 0;
    public enterCallCount = 0;

    protected override onTick(): NodeResult {
        return this.result;
    }

    protected override onTicked(result: NodeResult): void {
        this.tickedResults.push(result);
    }

    protected override onSuccess(): void {
        this.successCallCount++;
    }

    protected override onFailed(): void {
        this.failedCallCount++;
    }

    protected override onFinished(result: NodeResult): void {
        this.finishedResults.push(result);
    }

    protected override onAbort(): void {
        this.abortCallCount++;
    }

    protected override onReset(): void {
        this.resetCallCount++;
    }

    protected override onEnter(): void {
        this.enterCallCount++;
    }

    public resumeCallCount = 0;
    protected override onResume(): void {
        this.resumeCallCount++;
    }
}

describe("BTNode", () => {
    it("assigns unique auto-incrementing IDs", () => {
        const node1 = new ConcreteNode();
        const node2 = new ConcreteNode();

        expect(node2.id).toBe(node1.id + 1);
    });

    it("uses custom name as displayName when provided", () => {
        const node = new ConcreteNode("MyNode");

        expect(node.displayName).toBe("MyNode");
    });

    it("falls back to defaultName as displayName when no name provided", () => {
        const node = new ConcreteNode();

        expect(node.displayName).toBe("Action");
    });

    describe("Tick", () => {
        it("calls onTick and returns the result", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            const result = BTNode.Tick(node, ctx);

            expect(result).toBe(NodeResult.Running);
        });

        it("calls onSuccess when result is Succeeded", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.successCallCount).toBe(1);
            expect(node.failedCallCount).toBe(0);
        });

        it("calls onFailed when result is Failed", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Failed;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.failedCallCount).toBe(1);
            expect(node.successCallCount).toBe(0);
        });

        it("calls onFinished for Succeeded and Failed but not Running", () => {
            const node = new ConcreteNode();
            const ctx = createTickContext();

            node.result = NodeResult.Succeeded;
            BTNode.Tick(node, ctx);
            expect(node.finishedResults).toEqual(["Succeeded"]);

            node.result = NodeResult.Failed;
            BTNode.Tick(node, ctx);
            expect(node.finishedResults).toEqual(["Succeeded", "Failed"]);

            node.result = NodeResult.Running;
            BTNode.Tick(node, ctx);
            expect(node.finishedResults).toEqual(["Succeeded", "Failed"]);
        });

        it("calls lifecycle hooks in order: onTick -> onTicked -> onSuccess -> onFinished -> trace", () => {
            const callOrder: string[] = [];
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;

            const originalOnTicked = node["onTicked"].bind(node);
            const originalOnSuccess = node["onSuccess"].bind(node);
            const originalOnFinished = node["onFinished"].bind(node);

            node["onTick"] = () => {
                callOrder.push("onTick");
                return NodeResult.Succeeded;
            };
            node["onTicked"] = (result: NodeResult) => {
                callOrder.push("onTicked");
                originalOnTicked(result);
            };
            node["onSuccess"] = () => {
                callOrder.push("onSuccess");
                originalOnSuccess();
            };
            node["onFinished"] = (result: NodeResult) => {
                callOrder.push("onFinished");
                originalOnFinished(result);
            };

            const ctx = createTickContext({
                trace: () => {
                    callOrder.push("trace");
                },
            });

            BTNode.Tick(node, ctx);

            expect(callOrder).toEqual(["onTick", "onTicked", "onSuccess", "onFinished", "trace"]);
        });

        it("calls onEnter before onTick on first tick", () => {
            const callOrder: string[] = [];
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;

            node["onEnter"] = () => { callOrder.push("onEnter"); };
            node["onTick"] = () => {
                callOrder.push("onTick");
                return NodeResult.Succeeded;
            };

            const ctx = createTickContext();
            BTNode.Tick(node, ctx);

            expect(callOrder).toEqual(["onEnter", "onTick"]);
        });

        it("does not call onAbort during BTNode.Tick", () => {
            const node = new ConcreteNode();
            const ctx = createTickContext();

            node.result = NodeResult.Running;
            BTNode.Tick(node, ctx);

            node.result = NodeResult.Succeeded;
            BTNode.Tick(node, ctx);

            expect(node.abortCallCount).toBe(0);
        });
    });

    describe("onReset", () => {
        it("is called when transitioning from Running to Succeeded", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // Running
            expect(node.resetCallCount).toBe(0);

            node.result = NodeResult.Succeeded;
            BTNode.Tick(node, ctx); // Running -> Succeeded

            expect(node.resetCallCount).toBe(1);
        });

        it("is called when transitioning from Running to Failed", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // Running
            expect(node.resetCallCount).toBe(0);

            node.result = NodeResult.Failed;
            BTNode.Tick(node, ctx); // Running -> Failed

            expect(node.resetCallCount).toBe(1);
        });

        it("is NOT called when node succeeds without being Running first", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.resetCallCount).toBe(0);
        });

        it("is NOT called when node fails without being Running first", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Failed;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.resetCallCount).toBe(0);
        });

        it("is called when aborting a Running node", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // Make it Running
            BTNode.Abort(node, ctx);

            expect(node.resetCallCount).toBe(1);
        });

        it("is called AFTER onAbort when aborting", () => {
            const callOrder: string[] = [];
            const node = new ConcreteNode();
            node.result = NodeResult.Running;

            node["onReset"] = () => {
                callOrder.push("onReset");
            };
            node["onAbort"] = () => {
                callOrder.push("onAbort");
            };

            const ctx = createTickContext();
            BTNode.Tick(node, ctx); // Make it Running
            BTNode.Abort(node, ctx);

            expect(callOrder).toEqual(["onAbort", "onReset"]);
        });
    });

    describe("onEnter", () => {
        it("fires on the first tick of a fresh node", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.enterCallCount).toBe(1);
        });

        it("fires again after reset (Running → terminal → next tick)", () => {
            const node = new ConcreteNode();
            const ctx = createTickContext();

            node.result = NodeResult.Running;
            BTNode.Tick(node, ctx); // enter fires, now Running
            expect(node.enterCallCount).toBe(1);

            node.result = NodeResult.Succeeded;
            BTNode.Tick(node, ctx); // Running → Succeeded, reset fires

            BTNode.Tick(node, ctx); // fresh execution, enter fires again
            expect(node.enterCallCount).toBe(2);
        });

        it("does NOT fire on continuation ticks (Running → Running)", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // enter fires
            BTNode.Tick(node, ctx); // continuation, no enter
            BTNode.Tick(node, ctx); // continuation, no enter

            expect(node.enterCallCount).toBe(1);
        });

        it("fires on each fresh execution when node always returns terminal", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);
            BTNode.Tick(node, ctx);
            BTNode.Tick(node, ctx);

            expect(node.enterCallCount).toBe(3);
        });
    });

    describe("onResume", () => {
        it("fires on continuation ticks (Running → Running)", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // first tick, onEnter fires
            BTNode.Tick(node, ctx); // continuation, onResume fires
            BTNode.Tick(node, ctx); // continuation, onResume fires

            expect(node.resumeCallCount).toBe(2);
        });

        it("does NOT fire on first tick", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(node.resumeCallCount).toBe(0);
        });

        it("does NOT fire when node always returns terminal", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);
            BTNode.Tick(node, ctx);

            expect(node.resumeCallCount).toBe(0);
        });

        it("fires before onTick on continuation", () => {
            const callOrder: string[] = [];
            const node = new ConcreteNode();
            node.result = NodeResult.Running;

            node["onResume"] = () => { callOrder.push("onResume"); };
            node["onTick"] = () => {
                callOrder.push("onTick");
                return NodeResult.Running;
            };

            const ctx = createTickContext();
            BTNode.Tick(node, ctx); // first tick
            callOrder.length = 0;
            BTNode.Tick(node, ctx); // continuation

            expect(callOrder).toEqual(["onResume", "onTick"]);
        });
    });

    describe("Abort", () => {
        it("calls onAbort on a Running node", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Running;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // Make it Running
            BTNode.Abort(node, ctx);

            expect(node.abortCallCount).toBe(1);
        });

        it("is a no-op on a node that was never Running", () => {
            const node = new ConcreteNode();
            const ctx = createTickContext();

            BTNode.Abort(node, ctx);

            expect(node.abortCallCount).toBe(0);
        });

        it("is a no-op on a node that already completed", () => {
            const node = new ConcreteNode();
            node.result = NodeResult.Succeeded;
            const ctx = createTickContext();

            BTNode.Tick(node, ctx); // Completed, wasRunning is false
            BTNode.Abort(node, ctx);

            expect(node.abortCallCount).toBe(0);
        });
    });

    describe("decorate", () => {
        it("applies decorators right-to-left so first spec is outermost", () => {
            const action = new StubAction(NodeResult.Succeeded);

            const decorated = action.decorate(
                [Inverter],
                [ForceSuccess],
            );

            // Inner: ForceSuccess wraps action, Outer: Inverter wraps ForceSuccess
            // action -> Succeeded -> ForceSuccess -> Succeeded -> Inverter -> Failed
            const ctx = createTickContext();
            const result = BTNode.Tick(decorated, ctx);

            expect(result).toBe(NodeResult.Failed);
        });
    });
});
