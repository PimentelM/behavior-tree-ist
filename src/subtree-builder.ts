import { Action, BTNode, NodeResult, TickContext } from "./base";
import { ConditionNode } from "./base/condition";
import { Parallel, Selector, Sequence } from "./nodes";

type NodeName = string;
export type SubtreeBlueprint =
    BTNode |
    ["condition", NodeName, (ctx: TickContext) => boolean] |
    ["action", NodeName, (ctx: TickContext) => NodeResult] |
    ["sequence", NodeName, ...SubtreeBlueprint[]] |
    ["selector", NodeName, ...SubtreeBlueprint[]] |
    ["parallel", NodeName, ...SubtreeBlueprint[]]


// Experimental utility that might be useful for some use cases. 
export function buildSubtree(blueprint: SubtreeBlueprint): BTNode {
    if (blueprint instanceof BTNode) {
        return blueprint;
    }

    const [type, name, ...args] = blueprint;

    if (!Array.isArray(args[0])) {
        switch (type) {
            case "condition":
                return ConditionNode.from(name, args[0] as () => boolean);
            case "action":
                return Action.from(name, args[0] as () => NodeResult);
            default:
                throw new Error(`Unknown node type: ${type}`);
        }

    }

    const children = (args as SubtreeBlueprint[]).map(buildSubtree);
    switch (type) {
        case "sequence":
            return Sequence.from(name, children);
        case "selector":
            return Selector.from(name, children);
        case "parallel":
            return Parallel.from(name, children);
        default:
            throw new Error(`Unknown node type: ${type}`);
    }
}