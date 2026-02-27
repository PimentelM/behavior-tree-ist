import type { TickContext } from "./node";

export class AmbientContext {
    private static readonly tickContextStack: TickContext[] = [];
    private static readonly mutationNodeIdStack: number[] = [];

    public static pushTickContext(ctx: TickContext): void {
        AmbientContext.tickContextStack.push(ctx);
    }

    public static popTickContext(): void {
        AmbientContext.tickContextStack.pop();
    }

    public static getTickContext(): TickContext | undefined {
        return AmbientContext.tickContextStack.length > 0 ? AmbientContext.tickContextStack[AmbientContext.tickContextStack.length - 1] : undefined;
    }

    public static pushMutationNodeId(nodeId: number): void {
        AmbientContext.mutationNodeIdStack.push(nodeId);
    }

    public static popMutationNodeId(): void {
        AmbientContext.mutationNodeIdStack.pop();
    }

    public static getCurrentMutationNodeId(): number | undefined {
        return AmbientContext.mutationNodeIdStack.length > 0 ? AmbientContext.mutationNodeIdStack[AmbientContext.mutationNodeIdStack.length - 1] : undefined;
    }
}
