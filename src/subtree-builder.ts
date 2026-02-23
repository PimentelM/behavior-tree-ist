import { Action, BTNode, NodeResult, TickContext } from "./base";
import { ConditionNode } from "./base/condition";
import { Parallel, Selector, Sequence } from "./nodes";
import * as Decorators from "./nodes/decorators";

export interface NodeProps {
    name?: string;

    // Condition decorators
    guard?: { name?: string, condition: (ctx: TickContext) => boolean };
    succeedIf?: { name?: string, condition: (ctx: TickContext) => boolean };
    failIf?: { name?: string, condition: (ctx: TickContext) => boolean };

    // Behavior modifiers
    alwaysSucceed?: boolean;
    alwaysFail?: boolean;
    inverter?: boolean;
    runningIsFailure?: boolean;
    runningIsSuccess?: boolean;
    untilFail?: boolean;
    untilSuccess?: boolean;

    // Retry / Repeat
    repeat?: number; // max iterations, or -1 for infinite
    retry?: number; // max retries

    // Timing decorators
    debounce?: number; // ms
    cooldown?: number; // ms
    throttle?: number; // ms
    timeout?: number; // ms

    // Hooks
    onEnter?: (ctx: TickContext) => void;
    onResume?: (ctx: TickContext) => void;
    onReset?: (ctx: TickContext) => void;
    onAbort?: (ctx: TickContext) => void;
    onTicked?: (result: NodeResult, ctx: TickContext) => void;
    onSuccess?: (ctx: TickContext) => void;
    onFailure?: (ctx: TickContext) => void;
    onRunning?: (ctx: TickContext) => void;
    onSuccessOrRunning?: (ctx: TickContext) => void;
    onFailedOrRunning?: (ctx: TickContext) => void;
    onFinished?: (result: NodeResult & ('Succeeded' | 'Failed'), ctx: TickContext) => void;
}

export function applyDecorators(node: BTNode, props: NodeProps): BTNode {
    let current = node;

    // Validation
    if (props.alwaysSucceed && props.alwaysFail) throw new Error("Cannot use both alwaysSucceed and alwaysFail");
    if (props.succeedIf && props.failIf) throw new Error("Cannot use both succeedIf and failIf");
    if (props.runningIsFailure && props.runningIsSuccess) throw new Error("Cannot use both runningIsFailure and runningIsSuccess");
    if (props.untilFail && props.untilSuccess) throw new Error("Cannot use both untilFail and untilSuccess");


    // Order (Innermost to Outermost):
    // 1. Behavior modifications
    if (props.alwaysSucceed) current = current.decorate([Decorators.AlwaysSucceed]);
    else if (props.alwaysFail) current = current.decorate([Decorators.AlwaysFail]);

    if (props.inverter) current = current.decorate([Decorators.Inverter]);
    if (props.runningIsFailure) current = current.decorate([Decorators.RunningIsFailure]);
    else if (props.runningIsSuccess) current = current.decorate([Decorators.RunningIsSuccess]);

    // 2. Control Flow modifiers
    if (props.untilFail) current = current.decorate([Decorators.UntilFail]);
    else if (props.untilSuccess) current = current.decorate([Decorators.UntilSuccess]);

    if (props.repeat !== undefined) current = current.decorate([Decorators.Repeat, props.repeat]);
    if (props.retry !== undefined) current = current.decorate([Decorators.Retry, props.retry]);

    // 3. Guards / Condition overrides
    if (props.guard) current = current.decorate([Decorators.Guard, props.guard.name ?? "Guard", props.guard.condition]);
    // After the guard, we have the succeedIf and failIf decorators which are also guards but with different semantics
    if (props.succeedIf) current = current.decorate([Decorators.SucceedIf, props.succeedIf.name ?? "SucceedIf", props.succeedIf.condition]);
    else if (props.failIf) current = current.decorate([Decorators.FailIf, props.failIf.name ?? "FailIf", props.failIf.condition]);

    // 4. Timing
    if (props.debounce !== undefined) current = current.decorate([Decorators.Debounce, props.debounce]);
    if (props.cooldown !== undefined) current = current.decorate([Decorators.Cooldown, props.cooldown]);
    if (props.throttle !== undefined) current = current.decorate([Decorators.Throttle, props.throttle]);
    if (props.timeout !== undefined) current = current.decorate([Decorators.Timeout, props.timeout]);

    // 5. Hooks
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

    return current;
}

export function sequence(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Sequence.from(props.name || "Sequence", children), props);
}

export function selector(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Selector.from(props.name || "Selector", children), props);
}

export function parallel(props: NodeProps, children: BTNode[]): BTNode {
    return applyDecorators(Parallel.from(props.name || "Parallel", children), props);
}

export function action(props: NodeProps & { execute: (ctx: TickContext) => NodeResult }): BTNode {
    return applyDecorators(Action.from(props.name || "Action", props.execute), props);
}

export function condition(props: NodeProps & { eval: (ctx: TickContext) => boolean }): BTNode {
    return applyDecorators(ConditionNode.from(props.name || "Condition", props.eval), props);
}

export function guard(props: NodeProps & { eval: (ctx: TickContext) => boolean }, child: BTNode): BTNode {
    return applyDecorators(new Decorators.Guard(child, props.name || "Guard", props.eval), props);
}