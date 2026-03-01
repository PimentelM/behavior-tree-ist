import { describe, it, expect, vi } from "vitest";
import { sequence, fallback, parallel, action, condition, utilityFallback, utilitySequence, utility, displayState, subTree, applyDecorators } from "./index";
import { NodeResult } from "../base/types";
import { createNodeTicker, tickNode, StubAction } from "../test-helpers";


describe("Subtree Builder Factory", () => {
    it("builds a sequence with valid decorators", () => {
        const onEnterFn = vi.fn();

        const myTree = sequence({
            name: "Root",
            repeat: 3,
            onEnter: onEnterFn,
        }, [
            condition({ name: "Always True", eval: () => true }),
            action({ name: "Do Something", execute: () => NodeResult.Succeeded }),
            action({ name: 'Do Another Thing', execute: () => NodeResult.Succeeded })
        ]);



        const result = tickNode(myTree);
        expect(result).toBe(NodeResult.Running); // Repeat returns running until 3 successes
        expect(onEnterFn).toHaveBeenCalled();
    });

    it("throws when using conflicting decorators", () => {
        expect(() => {
            sequence({
                forceSuccess: true,
                forceFailure: true
            }, []);
        }).toThrow("Cannot use both forceSuccess and forceFailure");

    });

    it("builds a basic fallback", () => {
        const sel = fallback({ name: "MySelector" }, [
            action({ execute: () => NodeResult.Failed }),
            action({ execute: () => NodeResult.Succeeded })
        ]);

        const result = tickNode(sel);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("builds a basic parallel", () => {
        const par = parallel({ name: "MyParallel" }, [
            action({ execute: () => NodeResult.Succeeded }),
            action({ execute: () => NodeResult.Succeeded })
        ]);

        const result = tickNode(par);
        expect(result).toBe(NodeResult.Succeeded);
    });

    it("keeps Running children alive when keepRunningChildren is true", () => {
        const failing = new StubAction(NodeResult.Failed);
        const running = new StubAction(NodeResult.Running);
        const par = parallel({ name: "MyParallel", keepRunningChildren: true }, [failing, running]);

        const result = tickNode(par);

        expect(result).toBe(NodeResult.Failed);
        expect(running.abortCount).toBe(0);
    });

    it("builds a utility fallback", () => {
        let action1CallCount = 0;
        let action2CallCount = 0;
        const uf = utilityFallback({ name: "MyUtilityFallback" }, [
            utility({ scorer: () => 10 },
                action({ execute: () => { action1CallCount++; return NodeResult.Succeeded; } })
            ),
            utility({ scorer: () => 20 },
                action({ execute: () => { action2CallCount++; return NodeResult.Succeeded; } })
            )
        ]);

        const result = tickNode(uf);

        expect(result).toBe(NodeResult.Succeeded);
        expect(action1CallCount).toBe(0);
        expect(action2CallCount).toBe(1);
    });

    it("builds a utility sequence", () => {
        let action1CallCount = 0;
        let action2CallCount = 0;
        const calledOrder: string[] = [];
        const us = utilitySequence({ name: "MyUtilitySequence" }, [
            utility({ scorer: () => 10 },
                action({ execute: () => { action1CallCount++; calledOrder.push('10'); return NodeResult.Succeeded; } })
            ),
            utility({ scorer: () => 20 },
                action({ execute: () => { action2CallCount++; calledOrder.push('20'); return NodeResult.Succeeded; } })
            )
        ]);

        const result = tickNode(us);

        expect(result).toBe(NodeResult.Succeeded);
        expect(action1CallCount).toBe(1); // Since it's a sequence, both get ticked if both succeed
        expect(action2CallCount).toBe(1);
        expect(calledOrder).toEqual(['20', '10']);
    });

    it("builds a displayState node", () => {
        const node = displayState({
            name: "MyDisplay",
            display: () => ({ foo: "bar" })
        });

        expect(node.displayName).toBe("MyDisplay");
        expect(node.getDisplayState?.()).toEqual({ foo: "bar" });
        expect(tickNode(node)).toBe(NodeResult.Succeeded);
    });

    it("builds a metadata-only subtree boundary", () => {
        const node = subTree({
            name: "CombatBoundary",
            id: "combat-root",
            namespace: "combat"
        }, action({ execute: () => NodeResult.Succeeded }));

        expect(node.displayName).toBe("CombatBoundary");
        expect(node.getDisplayState?.()).toEqual({ id: "combat-root", namespace: "combat" });
        expect(tickNode(node)).toBe(NodeResult.Succeeded);
    });

    it("applies nonAbortable via NodeProps", () => {
        const child = new StubAction(NodeResult.Running);
        const node = applyDecorators(child, { nonAbortable: true });
        const ticker = createNodeTicker();

        expect(ticker.tick(node)).toBe(NodeResult.Running);
        ticker.abort(node);

        expect(child.abortCount).toBe(0);
    });

    it("supports activity metadata and displayActivity alias", () => {
        const byActivity = action({
            activity: "Patrolling",
            execute: () => NodeResult.Succeeded,
        });
        expect(byActivity.activity).toBe("Patrolling");

        const byAlias = action({
            displayActivity: "Kiting",
            execute: () => NodeResult.Succeeded,
        });
        expect(byAlias.activity).toBe("Kiting");

        const byDefaultLabel = action({
            activity: true,
            execute: () => NodeResult.Succeeded,
        });
        expect(byDefaultLabel.activity).toBe(true);

        const byAliasDefaultLabel = action({
            displayActivity: true,
            execute: () => NodeResult.Succeeded,
        });
        expect(byAliasDefaultLabel.activity).toBe(true);
    });

    it("throws when both activity and displayActivity are provided", () => {
        expect(() => action({
            activity: "A",
            displayActivity: "A",
            execute: () => NodeResult.Succeeded,
        })).toThrow("Only one activity label prop is allowed");

        expect(() => action({
            activity: "A",
            displayActivity: "B",
            execute: () => NodeResult.Succeeded,
        })).toThrow("Only one activity label prop is allowed");

        expect(() => action({
            activity: true,
            displayActivity: "A",
            execute: () => NodeResult.Succeeded,
        })).toThrow("Only one activity label prop is allowed");
    });
});
