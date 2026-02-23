import { describe, it, expect } from "vitest";
import { BTNode } from "./node";
import { NodeResult, NodeFlags } from "./types";
import { createTickContext, StubAction } from "../test-helpers";
import { Inverter } from "../nodes/decorators/inverter";
import { AlwaysSucceed } from "../nodes/decorators/always-succeed";

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
    });

    describe("Abort", () => {
        it("calls onAbort on the node", () => {
            const node = new ConcreteNode();
            const ctx = createTickContext();

            BTNode.Abort(node, ctx);

            expect(node.abortCallCount).toBe(1);
        });
    });

    describe("decorate", () => {
        it("applies decorators right-to-left so first spec is outermost", () => {
            const action = new StubAction(NodeResult.Succeeded);

            const decorated = action.decorate(
                [Inverter],
                [AlwaysSucceed],
            );

            // Inner: AlwaysSucceed wraps action, Outer: Inverter wraps AlwaysSucceed
            // action -> Succeeded -> AlwaysSucceed -> Succeeded -> Inverter -> Failed
            const ctx = createTickContext();
            const result = BTNode.Tick(decorated, ctx);

            expect(result).toBe(NodeResult.Failed);
        });
    });
});
