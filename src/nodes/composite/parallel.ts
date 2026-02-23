import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

interface ParallelPolicy {
    getResult(successCount: number, failureCount: number, runningCount: number): NodeResult;
}

/**
 * Default policy: Succeed when all children succeed, fail when any child fails.
 * This matches the "Parallel Sequence" (∧) semantics from Ögren's BT formalism.
 */
const DefaultParallelPolicy: ParallelPolicy = {
    getResult(successCount: number, failureCount: number, runningCount: number): NodeResult {
        if (failureCount > 0) return NodeResult.Failed;
        if (runningCount > 0) return NodeResult.Running;
        return NodeResult.Succeeded;
    }
}

export class SuccessThresholdParallelPolicy implements ParallelPolicy {
    constructor(public successThreshold: number = 0) {
    }

    getResult(successCount: number, _failureCount: number, runningCount: number): NodeResult {
        if (successCount >= this.successThreshold) {
            return NodeResult.Succeeded;
        }
        if (successCount + runningCount < this.successThreshold) {
            return NodeResult.Failed;
        }
        return NodeResult.Running;
    }
}

export const AlwaysRunningParallelPolicy: ParallelPolicy = {
    getResult(_successCount: number, _failureCount: number, _runningCount: number): NodeResult {
        return NodeResult.Running;
    }
}

export class Parallel extends Composite {
    public override readonly defaultName = "Parallel";

    public static from(nodes: BTNode[]): Parallel
    public static from(name: string, nodes: BTNode[], policy?: ParallelPolicy): Parallel
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[], policy?: ParallelPolicy): Parallel {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new Parallel(name, policy);
        composite.setNodes(nodes);
        return composite;
    }

    constructor(name?: string, private policy: ParallelPolicy = DefaultParallelPolicy) {
        super(name);
        this.addFlags(NodeFlags.Parallel);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`Parallel node ${this.name} has no nodes`);
        }

        let successCount = 0;
        let failureCount = 0;
        let runningCount = 0;
        const runningIndexes: number[] = [];

        for (let i = 0; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);
            if (status === NodeResult.Succeeded) successCount++;
            else if (status === NodeResult.Failed) failureCount++;
            else {
                runningCount++;
                runningIndexes.push(i);
            }
        }

        const result = this.policy.getResult(successCount, failureCount, runningCount);

        if (result !== NodeResult.Running && runningIndexes.length > 0) {
            this.abortChildrenByIndex(runningIndexes, ctx);
        }

        return result;
    }
}