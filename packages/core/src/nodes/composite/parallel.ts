import { Composite } from "../../base/composite";
import { NodeResult, NodeFlags } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

export type ParallelPolicy = (successCount: number, failureCount: number, runningCount: number) => NodeResult;

/**
 * Default policy: Succeed when all children succeed, fail when any child fails.
 * This matches the "Parallel Sequence" (∧) semantics from Ögren's BT formalism.
 */
export const RequireAllSuccess: ParallelPolicy = (_successCount: number, failureCount: number, runningCount: number): NodeResult => {
    if (failureCount > 0) return NodeResult.Failed;
    if (runningCount > 0) return NodeResult.Running;
    return NodeResult.Succeeded;
};

export const RequireOneSuccess: ParallelPolicy = (successCount: number, _failureCount: number, runningCount: number): NodeResult => {
    if (successCount > 0) return NodeResult.Succeeded;
    if (runningCount > 0) return NodeResult.Running;
    return NodeResult.Failed;
};

export const SuccessThreshold = (threshold: number): ParallelPolicy => {
    return (successCount: number, _failureCount: number, runningCount: number): NodeResult => {
        if (successCount >= threshold) {
            return NodeResult.Succeeded;
        }
        if (successCount + runningCount < threshold) {
            return NodeResult.Failed;
        }
        return NodeResult.Running;
    };
};

export const AlwaysRunningPolicy: ParallelPolicy = (_successCount: number, _failureCount: number, _runningCount: number): NodeResult => {
    return NodeResult.Running;
};

export const AlwaysSucceedPolicy: ParallelPolicy = (_successCount: number, _failureCount: number, _runningCount: number): NodeResult => {
    return NodeResult.Succeeded;
};

export const AlwaysFailPolicy: ParallelPolicy = (_successCount: number, _failureCount: number, _runningCount: number): NodeResult => {
    return NodeResult.Failed;
};

export const FailThreshold = (threshold: number): ParallelPolicy => {
    return (_successCount: number, failureCount: number, runningCount: number): NodeResult => {
        if (failureCount >= threshold) {
            return NodeResult.Failed;
        }
        if (failureCount + runningCount < threshold) {
            return NodeResult.Succeeded;
        }
        return NodeResult.Running;
    };
};

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

    constructor(name?: string, private policy: ParallelPolicy = RequireAllSuccess) {
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

        for (let i = 0; i < this.nodes.length; i++) {
            const status = BTNode.Tick(this.nodes[i], ctx);
            if (status === NodeResult.Succeeded) successCount++;
            else if (status === NodeResult.Failed) failureCount++;
            else runningCount++;
        }

        const result = this.policy(successCount, failureCount, runningCount);

        if (result !== NodeResult.Running) {
            this.abortAllChildren(ctx);
        }

        return result;
    }
}