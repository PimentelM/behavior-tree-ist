import { describe, it, expect } from "vitest";
import { multiRef } from "./multi-ref";
import { BTNode } from "./node";
import { NodeResult } from "./types";
import { Action } from "./action";
import { createTickContext } from "../test-helpers";
import { Sequence } from "../nodes/composite/sequence";
import { AmbientContext } from "./ambient-context";

describe("MultiRef", () => {
    describe("basics", () => {
        it("creates object with initial values", () => {
            const bb = multiRef("myBB", { targetId: 0, health: 100 });

            expect(bb.targetId).toBe(0);
            expect(bb.health).toBe(100);
            expect(bb.name).toBe("myBB");
        });

        it("fields are writable", () => {
            const bb = multiRef("bb", { x: 1, y: 2 });

            bb.x = 10;
            bb.y = 20;

            expect(bb.x).toBe(10);
            expect(bb.y).toBe(20);
        });

        it(".name is non-enumerable", () => {
            const bb = multiRef("myBB", { health: 100 });
            expect(Object.keys(bb)).toEqual(["health"]);
        });

        it("fields are enumerable", () => {
            const bb = multiRef("bb", { a: 1, b: "two", c: true });
            expect(Object.keys(bb)).toEqual(["a", "b", "c"]);
        });
    });

    describe("ambient context tracing", () => {
        it("field write inside BTNode.Tick produces RefChangeEvent", () => {
            const bb = multiRef("myBB", { targetId: 0, health: 100 });
            const node = Action.from("set-target", () => {
                bb.targetId = 42;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 5, now: 100 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toEqual({
                tickId: 5,
                timestamp: 100,
                refName: "myBB.targetId",
                nodeId: node.id,
                newValue: 42,
                isAsync: false,
            });
        });

        it("multiple field writes produce separate events", () => {
            const bb = multiRef("bb", { x: 0, y: 0 });
            const node = Action.from("update", () => {
                bb.x = 10;
                bb.y = 20;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].refName).toBe("bb.x");
            expect(ctx.refEvents[0].newValue).toBe(10);
            expect(ctx.refEvents[1].refName).toBe("bb.y");
            expect(ctx.refEvents[1].newValue).toBe(20);
        });

        it("no-op write (same value) does not emit event", () => {
            const bb = multiRef("bb", { health: 100 });
            const node = Action.from("noop", () => {
                bb.health = 100;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
        });

        it("write outside tick produces no event and no error", () => {
            const bb = multiRef("bb", { value: 0 });

            bb.value = 42;

            expect(bb.value).toBe(42);
        });

        it("does not produce event when isStateTraceEnabled is false", () => {
            const bb = multiRef("bb", { x: 0 });
            const node = Action.from("set", () => {
                bb.x = 1;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ isStateTraceEnabled: false });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
            expect(bb.x).toBe(1);
        });

        it("each field uses its own qualified refName", () => {
            const bb = multiRef("agent", { posX: 0, posY: 0, rotation: 0 });
            const node = Action.from("move", () => {
                bb.posX = 5;
                bb.rotation = 90;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].refName).toBe("agent.posX");
            expect(ctx.refEvents[1].refName).toBe("agent.rotation");
        });
    });

    describe("stack isolation", () => {
        it("nested ticks share same ctx correctly", () => {
            const bb = multiRef("bb", { count: 0 });
            const child1 = Action.from("c1", () => {
                bb.count = 1;
                return NodeResult.Succeeded;
            });
            const child2 = Action.from("c2", () => {
                bb.count = 2;
                return NodeResult.Succeeded;
            });
            const seq = Sequence.from("seq", [child1, child2]);
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(seq, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].newValue).toBe(1);
            expect(ctx.refEvents[1].newValue).toBe(2);
        });

        it("separate ticks get separate refEvents", () => {
            const bb = multiRef("bb", { score: 0 });
            const node1 = Action.from("n1", () => {
                bb.score = 10;
                return NodeResult.Succeeded;
            });
            const node2 = Action.from("n2", () => {
                bb.score = 20;
                return NodeResult.Succeeded;
            });

            const ctx1 = createTickContext({ tickId: 1, now: 0 });
            const ctx2 = createTickContext({ tickId: 2, now: 100 });

            BTNode.Tick(node1, ctx1);
            BTNode.Tick(node2, ctx2);

            expect(ctx1.refEvents).toHaveLength(1);
            expect(ctx1.refEvents[0].newValue).toBe(10);
            expect(ctx2.refEvents).toHaveLength(1);
            expect(ctx2.refEvents[0].newValue).toBe(20);
        });

        it("if a hook throws, the stack is cleaned up", () => {
            const bb = multiRef("bb", { val: 0 });
            const throwingNode = Action.from("throw", () => {
                throw new Error("boom");
            });

            const ctx1 = createTickContext({ tickId: 1, now: 0 });
            expect(() => BTNode.Tick(throwingNode, ctx1)).toThrow("boom");

            const workingNode = Action.from("ok", () => {
                bb.val = 42;
                return NodeResult.Succeeded;
            });
            const ctx2 = createTickContext({ tickId: 2, now: 100 });
            BTNode.Tick(workingNode, ctx2);

            expect(ctx2.refEvents).toHaveLength(1);
            expect(ctx2.refEvents[0].newValue).toBe(42);
            expect(AmbientContext.getTickContext()).toBeUndefined();
        });
    });
});
