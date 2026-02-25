import { describe, it, expect, vi } from "vitest";
import { sequence, fallback, parallel, action, condition, precondition } from "./index";
import { NodeResult } from "../base/types";
import { tickNode } from "../test-helpers";


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

    it("wraps a node in a precondition", () => {
        const g = precondition({ eval: () => false }, action({ execute: () => NodeResult.Succeeded }));

        const result = tickNode(g);
        expect(result).toBe(NodeResult.Failed); // Guard blocks execution
    });
});
