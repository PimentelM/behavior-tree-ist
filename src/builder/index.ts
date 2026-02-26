import { ConditionNode } from "../base/condition";
import { Action, BTNode, NodeResult, TickContext } from "../base";
import { Parallel, Fallback, Sequence, SequenceWithMemory, FallbackWithMemory, AlwaysSuccess, AlwaysFailure, AlwaysRunning, Sleep, IfThenElse } from "../nodes";
import { UtilityFallback } from "../nodes/composite/utility-fallback";
import { UtilitySequence } from "../nodes/composite/utility-sequence";
import { UtilityScorer } from "../base/utility";
import { Utility } from "../nodes/decorators/utility";
import * as Decorators from "../nodes/decorators";
import { AnyDecoratorSpec } from "../base/node";

export interface NodeProps {
    name?: string;

    tag?: string;
    tags?: string[];

    // Generic decorators array application
    decorate?: AnyDecoratorSpec | readonly AnyDecoratorSpec[];

    // Condition decorators
    precondition?: { name?: string, condition: (ctx: TickContext) => boolean };
    succeedIf?: { name?: string, condition: (ctx: TickContext) => boolean };
    failIf?: { name?: string, condition: (ctx: TickContext) => boolean };

    // Behavior modifiers
    forceSuccess?: boolean;
    forceFailure?: boolean;
    inverter?: boolean;
    runningIsFailure?: boolean;
    runningIsSuccess?: boolean;
    keepRunningUntilFailure?: boolean;
    untilSuccess?: boolean;
    runOnce?: boolean;

    // Retry / Repeat
    repeat?: number; // max iterations, or -1 for infinite
    retryUntilSuccessful?: number; // max retries

    // Timing decorators
    requireSustainedSuccess?: number;
    cooldown?: number;
    throttle?: number;
    timeout?: number;
    delay?: number;

    // Tick-managed lifecycle hooks (invoked automatically via BTNode.Tick)
    onEnter?: (ctx: TickContext) => void;
    onResume?: (ctx: TickContext) => void;
    onReset?: (ctx: TickContext) => void;
    onTicked?: (result: NodeResult, ctx: TickContext) => void;
    onSuccess?: (ctx: TickContext) => void;
    onFailure?: (ctx: TickContext) => void;
    onRunning?: (ctx: TickContext) => void;
    onSuccessOrRunning?: (ctx: TickContext) => void;
    onFailedOrRunning?: (ctx: TickContext) => void;
    onFinished?: (result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext) => void;

    // Abort-only hook (invoked by BTNode.Abort, not by BTNode.Tick)
    onAbort?: (ctx: TickContext) => void;
}

export function applyDecorators(node: BTNode, props: NodeProps): BTNode {
    let current = node;

    // Validation
    if (props.forceSuccess && props.forceFailure) throw new Error("Cannot use both forceSuccess and forceFailure");
    if (props.succeedIf && props.failIf) throw new Error("Cannot use both succeedIf and failIf");
    if (props.runningIsFailure && props.runningIsSuccess) throw new Error("Cannot use both runningIsFailure and runningIsSuccess");
    if (props.keepRunningUntilFailure && props.untilSuccess) throw new Error("Cannot use both keepRunningUntilFailure and untilSuccess");


    // Order (Innermost to Outermost):
    // 1. Behavior modifications
    if (props.forceSuccess) current = current.decorate([Decorators.ForceSuccess]);
    else if (props.forceFailure) current = current.decorate([Decorators.ForceFailure]);

    if (props.inverter) current = current.decorate([Decorators.Inverter]);
    if (props.runningIsFailure) current = current.decorate([Decorators.RunningIsFailure]);
    else if (props.runningIsSuccess) current = current.decorate([Decorators.RunningIsSuccess]);

    // 2. Control Flow modifiers
    if (props.keepRunningUntilFailure) current = current.decorate([Decorators.KeepRunningUntilFailure]);
    else if (props.untilSuccess) current = current.decorate([Decorators.UntilSuccess]);
    if (props.runOnce) current = current.decorate([Decorators.RunOnce]);

    if (props.repeat !== undefined) current = current.decorate([Decorators.Repeat, props.repeat]);
    if (props.retryUntilSuccessful !== undefined) current = current.decorate([Decorators.RetryUntilSuccessful, props.retryUntilSuccessful]);

    // 3. Guards / Condition overrides
    if (props.precondition) current = current.decorate([Decorators.Precondition, props.precondition.name ?? "Precondition", props.precondition.condition]);
    // After the precondition, we have the succeedIf and failIf decorators which are also guards but with different semantics
    if (props.succeedIf) current = current.decorate([Decorators.SucceedIf, props.succeedIf.name ?? "SucceedIf", props.succeedIf.condition]);
    else if (props.failIf) current = current.decorate([Decorators.FailIf, props.failIf.name ?? "FailIf", props.failIf.condition]);

    // 4. Timing
    if (props.requireSustainedSuccess !== undefined) current = current.decorate([Decorators.RequireSustainedSuccess, props.requireSustainedSuccess]);
    if (props.cooldown !== undefined) current = current.decorate([Decorators.Cooldown, props.cooldown]);
    if (props.throttle !== undefined) current = current.decorate([Decorators.Throttle, props.throttle]);
    if (props.timeout !== undefined) current = current.decorate([Decorators.Timeout, props.timeout]);
    if (props.delay !== undefined) current = current.decorate([Decorators.Delay, props.delay]);

    // 5. Hooks (tick-managed first, then abort-only)
    if (props.onEnter) current = current.decorate([Decorators.OnEnter, props.onEnter]);
    if (props.onResume) current = current.decorate([Decorators.OnResume, props.onResume]);
    if (props.onReset) current = current.decorate([Decorators.OnReset, props.onReset]);
    if (props.onAbort) current = current.decorate([Decorators.OnAbort, props.onAbort]);
    if (props.onTicked) current = current.decorate([Decorators.OnTicked, props.onTicked]);
    if (props.onSuccess) current = current.decorate([Decorators.OnSuccess, props.onSuccess]);
    if (props.onFailure) current = current.decorate([Decorators.OnFailure, props.onFailure]);
    if (props.onRunning) current = current.decorate([Decorators.OnRunning, props.onRunning]);
    if (props.onSuccessOrRunning) current = current.decorate([Decorators.OnSuccessOrRunning, props.onSuccessOrRunning]);
    if (props.onFailedOrRunning) current = current.decorate([Decorators.OnFailedOrRunning, props.onFailedOrRunning]);
    if (props.onFinished) current = current.decorate([Decorators.OnFinished, props.onFinished]);

    // 6. Generic decorators
    if (props.decorate) {
        if (Array.isArray(props.decorate) && props.decorate.length > 0) {
            if (Array.isArray(props.decorate[0])) {
                // Array of specs
                // @ts-expect-error - dynamic spread for generic specs
                current = current.decorate(...props.decorate);
            } else {
                // Single spec
                // @ts-expect-error - dynamic spread for generic specs
                current = current.decorate(props.decorate);
            }
        }
    }

    if (props.tag) {
        current.addTags([props.tag]);
    }
    if (props.tags && props.tags.length > 0) {
        current.addTags(props.tags);
    }

    return current;
}

export function sequence(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Sequence.from(props.name || "Sequence", children), props);
}

export function fallback(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Fallback.from(props.name || "Fallback", children), props);
}

export const selector = fallback;

export function parallel(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Parallel.from(props.name || "Parallel", children), props);
}

export function utilityFallback(props: NodeProps, children: Utility[]): BTNode {
    const fallback = new UtilityFallback(props.name || "UtilityFallback");
    fallback.setNodes(children);
    return applyDecorators(fallback, props);
}

export const utilitySelector = utilityFallback;

export function utilitySequence(props: NodeProps, children: Utility[]): BTNode {
    const seq = new UtilitySequence(props.name || "UtilitySequence");
    seq.setNodes(children);
    return applyDecorators(seq, props);
}

export function ifThenElse(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(IfThenElse.from(props.name || "IfThenElse", children as [BTNode, BTNode, BTNode]), props);
}

export function sequenceWithMemory(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(SequenceWithMemory.from(props.name || "SequenceWithMemory", children), props);
}

export function fallbackWithMemory(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(FallbackWithMemory.from(props.name || "FallbackWithMemory", children), props);
}

export const selectorWithMemory = fallbackWithMemory;

export function utility(props: NodeProps & { scorer: UtilityScorer }, child: BTNode): Utility {
    return new Utility(child, props.scorer);
}

export function action(props: NodeProps & { execute: (ctx: TickContext) => NodeResult }): BTNode {
    return applyDecorators(Action.from(props.name || "Action", props.execute), props);
}

export function condition(props: NodeProps & { eval: (ctx: TickContext) => boolean }): BTNode {
    return applyDecorators(ConditionNode.from(props.name || "Condition", props.eval), props);
}

export function alwaysRunning(props: NodeProps = {}): BTNode {
    return applyDecorators(new AlwaysRunning(), props);
}

export function alwaysSuccess(props: NodeProps = {}): BTNode {
    return applyDecorators(new AlwaysSuccess(), props);
}

export function alwaysFailure(props: NodeProps = {}): BTNode {
    return applyDecorators(new AlwaysFailure(), props);
}

export function sleep(props: NodeProps & { duration: number }): BTNode {
    return applyDecorators(new Sleep(props.duration), props);
}
