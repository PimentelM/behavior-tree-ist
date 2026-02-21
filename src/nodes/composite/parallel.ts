import { Composite } from "../../base/composite";
import { NodeResult, NodeType } from "../../base/types";
import { BTNode, TickContext } from "../../base/node";

interface ParallelPolicy {
    getResult(successCount: number, failureCount: number, runningCount: number): NodeResult;
}

const DefaultParallelPolicy: ParallelPolicy = {
    getResult(): NodeResult {
        return NodeResult.Succeeded;
    }
}

export class SuccessThresholdParallelPolicy implements ParallelPolicy {
    constructor(public successThreshold: number = 0) {
    }

    getResult(successCount: number, _: number, runningCount: number): NodeResult {
        return successCount + runningCount >= this.successThreshold ? NodeResult.Succeeded : NodeResult.Failed;
    }
}

export const AlwaysRunningParallelPolicy: ParallelPolicy = {
    getResult(successCount: number, _: number, runningCount: number): NodeResult {
        return NodeResult.Running;
    }
}

export class Parallel extends Composite {
    public readonly NODE_TYPE: NodeType = "Parallel";

    public static from(nodes: BTNode[]): Parallel
    public static from(name: string, nodes: BTNode[], policy?: ParallelPolicy): Parallel
    public static from(nameOrNodes: string | BTNode[], possiblyNodes?: BTNode[], policy?: ParallelPolicy): Parallel {
        const name = typeof nameOrNodes === "string" ? nameOrNodes : "";
        const nodes = Array.isArray(nameOrNodes) ? nameOrNodes : possiblyNodes!;
        const composite = new Parallel(name, policy);
        composite.setNodes(nodes);
        return composite;
    }

    constructor(name: string, private policy: ParallelPolicy = DefaultParallelPolicy) {
        super(name);
    }

    protected override onTick(ctx: TickContext): NodeResult {
        if (this.nodes.length <= 0) {
            throw new Error(`Parallel node ${this.name} has no nodes`);
        }

        let successCount = 0;
        let failureCount = 0;
        let runningCount = 0;

        for (const node of this.nodes) {
            const status = BTNode.Tick(node, ctx);
            if (status === NodeResult.Succeeded) successCount++;
            else if (status === NodeResult.Failed) failureCount++;
            else runningCount++;
        }

        return this.policy.getResult(successCount, failureCount, runningCount);
    }
}