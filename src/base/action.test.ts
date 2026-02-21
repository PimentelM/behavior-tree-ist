import { describe, it, expect } from "vitest";
import { Action } from "./action";
import { BTNode, TickContext } from "./node";
import { NodeResult } from "./types";
import { createTickContext } from "../test-helpers";

describe("Action", () => {
    describe("from", () => {
        it("creates an action returning the function result", () => {
            const action = Action.from("test", () => NodeResult.Running);
            const ctx = createTickContext();

            const result = BTNode.Tick(action, ctx);

            expect(result).toBe(NodeResult.Running);
        });

        it("assigns the given name and passes TickContext to the function", () => {
            let receivedCtx: TickContext | undefined;
            const action = Action.from("myAction", (ctx) => {
                receivedCtx = ctx;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 42 });

            BTNode.Tick(action, ctx);

            expect(action.name).toBe("myAction");
            expect(receivedCtx).toBe(ctx);
        });
    });
});
