import { describe, it, expect } from "vitest";
import { ref, readonlyRef, derivedRef, objectRef, patchObjectRef } from "./ref";
import { BTNode } from "./node";
import { NodeResult } from "./types";
import { Action } from "./action";
import { createTickContext } from "../test-helpers";
import { Sequence } from "../nodes/composite/sequence";
import { AmbientContext } from "./ambient-context";

describe("Ref", () => {
    describe("basics", () => {
        it("factory creates ref with initial value", () => {
            const r = ref(42, "counter");
            expect(r.value).toBe(42);
            expect(r.name).toBe("counter");
        });

        it("factory creates unnamed ref", () => {
            const r = ref("hello");
            expect(r.value).toBe("hello");
            expect(r.name).toBeUndefined();
        });

        it(".value = x updates the value", () => {
            const r = ref(0);
            r.value = 10;
            expect(r.value).toBe(10);
        });

        it(".set(x) updates the value", () => {
            const r = ref(0);
            r.set(10);
            expect(r.value).toBe(10);
        });

        it(".asReadonly() returns same object typed as ReadonlyRef", () => {
            const r = ref(5, "x");
            const ro = r.asReadonly();
            expect(ro).toBe(r);
            expect(ro.value).toBe(5);
            expect(ro.name).toBe("x");
        });

        it("works with object values", () => {
            const r = ref({ x: 1, y: 2 }, "pos");
            expect(r.value).toEqual({ x: 1, y: 2 });
            r.value = { x: 3, y: 4 };
            expect(r.value).toEqual({ x: 3, y: 4 });
        });
    });

    describe("ambient context tracing", () => {
        it("ref write inside BTNode.Tick produces RefChangeEvent", () => {
            const counter = ref(0, "counter");
            const node = Action.from("inc", () => {
                counter.value = 1;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 5, now: 100 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toEqual({
                tickId: 5,
                timestamp: 100,
                refName: "counter",
                nodeId: node.id,
                newValue: 1,
                isAsync: false,
            });
        });

        it("multiple writes produce multiple events", () => {
            const counter = ref(0, "counter");
            const node = Action.from("inc", () => {
                counter.value = 1;
                counter.value = 2;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].newValue).toBe(1);
            expect(ctx.refEvents[1].newValue).toBe(2);
            expect(ctx.refEvents[0].isAsync).toBe(false);
            expect(ctx.refEvents[1].isAsync).toBe(false);
        });

        it("write outside tick produces no event and no error", () => {
            const counter = ref(0, "counter");
            counter.value = 42;
            expect(counter.value).toBe(42);
            // no ambient context, so no event
        });

        it("unnamed ref produces no event even during tick", () => {
            const counter = ref(0);
            const node = Action.from("inc", () => {
                counter.value = 1;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
            expect(counter.value).toBe(1);
        });

        it("write in onEnter hook traces correctly", () => {
            const started = ref(false, "started");

            class EnterAction extends Action {
                readonly defaultName = "EnterAction";
                protected override onEnter(): void {
                    started.value = true;
                }
                protected override onTick(): NodeResult {
                    return NodeResult.Succeeded;
                }
            }

            const node = new EnterAction();
            const ctx = createTickContext({ tickId: 1, now: 50 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toEqual({
                tickId: 1,
                timestamp: 50,
                refName: "started",
                nodeId: node.id,
                newValue: true,
                isAsync: false,
            });
        });

        it("write in onAbort via BTNode.Abort traces correctly", () => {
            const aborted = ref(false, "aborted");

            class AbortAction extends Action {
                readonly defaultName = "AbortAction";
                protected override onTick(): NodeResult {
                    return NodeResult.Running;
                }
                protected override onAbort(): void {
                    aborted.value = true;
                }
            }

            const node = new AbortAction();
            const tickCtx = createTickContext({ tickId: 1, now: 0 });
            BTNode.Tick(node, tickCtx);

            const abortCtx = createTickContext({ tickId: 2, now: 10 });
            BTNode.Abort(node, abortCtx);

            expect(abortCtx.refEvents).toHaveLength(1);
            expect(abortCtx.refEvents[0]).toEqual({
                tickId: 2,
                timestamp: 10,
                refName: "aborted",
                nodeId: node.id,
                newValue: true,
                isAsync: false,
            });
        });

        it("does not produce RefChangeEvent when isStateTraceEnabled is false", () => {
            const counter = ref(0, "counter");
            const node = Action.from("inc", () => {
                counter.value = 1;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 5, now: 100, isStateTraceEnabled: false });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
            expect(counter.value).toBe(1);
        });
    });

    describe("explicit ctx .set(value, ctx)", () => {
        it("traces to the provided ctx, not the ambient one", () => {
            const counter = ref(0, "counter");
            const explicitCtx = createTickContext({ tickId: 99, now: 500 });

            const node = Action.from("inc", () => {
                counter.set(1, explicitCtx);
                return NodeResult.Succeeded;
            });
            const ambientCtx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(node, ambientCtx);

            expect(ambientCtx.refEvents).toHaveLength(0);
            expect(explicitCtx.refEvents).toHaveLength(1);
            expect(explicitCtx.refEvents[0].tickId).toBe(99);
            expect(explicitCtx.refEvents[0].nodeId).toBe(node.id);
        });

        it("works when no ambient ctx exists", () => {
            const counter = ref(0, "counter");
            const ctx = createTickContext({ tickId: 10, now: 200 });

            counter.set(42, ctx);

            expect(counter.value).toBe(42);
            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toEqual({
                tickId: 10,
                timestamp: 200,
                refName: "counter",
                nodeId: undefined,
                newValue: 42,
                isAsync: false,
            });
        });
    });

    describe("stack isolation", () => {
        it("nested ticks (composite -> children) share same ctx correctly", () => {
            const counter = ref(0, "counter");
            const child1 = Action.from("child1", () => {
                counter.value = 1;
                return NodeResult.Succeeded;
            });
            const child2 = Action.from("child2", () => {
                counter.value = 2;
                return NodeResult.Succeeded;
            });
            const seq = Sequence.from("seq", [child1, child2]);
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(seq, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].newValue).toBe(1);
            expect(ctx.refEvents[1].newValue).toBe(2);
        });

        it("two different trees ticked sequentially get separate refEvents", () => {
            const counter = ref(0, "counter");
            const node1 = Action.from("n1", () => {
                counter.value = counter.value + 1;
                return NodeResult.Succeeded;
            });
            const node2 = Action.from("n2", () => {
                counter.value = counter.value + 10;
                return NodeResult.Succeeded;
            });

            const ctx1 = createTickContext({ tickId: 1, now: 0 });
            const ctx2 = createTickContext({ tickId: 2, now: 100 });

            BTNode.Tick(node1, ctx1);
            BTNode.Tick(node2, ctx2);

            expect(ctx1.refEvents).toHaveLength(1);
            expect(ctx1.refEvents[0].newValue).toBe(1);

            expect(ctx2.refEvents).toHaveLength(1);
            expect(ctx2.refEvents[0].newValue).toBe(11);
        });

        it("if a hook throws, the stack is cleaned up", () => {
            const counter = ref(0, "counter");
            const throwingNode = Action.from("throw", () => {
                throw new Error("boom");
            });

            const ctx1 = createTickContext({ tickId: 1, now: 0 });
            expect(() => BTNode.Tick(throwingNode, ctx1)).toThrow("boom");

            // Stack should be clean: next tick should work fine
            const workingNode = Action.from("ok", () => {
                counter.value = 42;
                return NodeResult.Succeeded;
            });
            const ctx2 = createTickContext({ tickId: 2, now: 100 });
            BTNode.Tick(workingNode, ctx2);

            expect(ctx2.refEvents).toHaveLength(1);
            expect(ctx2.refEvents[0].newValue).toBe(42);
            expect(AmbientContext.getTickContext()).toBeUndefined();
        });
    });

    describe("ReadonlyRef", () => {
        it("readonlyRef() reflects source Ref updates via .value", () => {
            const source = ref(10, "src");
            const ro = readonlyRef(source);

            expect(ro.value).toBe(10);

            source.value = 20;
            expect(ro.value).toBe(20);
        });
    });

    describe("objectRef", () => {
        it("field reads return initial values", () => {
            const state = objectRef({ health: 100, mana: 50 }, "player");

            expect(state.health).toBe(100);
            expect(state.mana).toBe(50);
        });

        it("field write inside tick produces RefChangeEvent with correct metadata", () => {
            const state = objectRef({ health: 100 }, "player");
            const node = Action.from("attack", () => {
                state.health = 80;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 5, now: 100 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toEqual({
                tickId: 5,
                timestamp: 100,
                refName: "player",
                fieldName: "health",
                nodeId: node.id,
                newValue: 80,
                isAsync: false,
            });
        });

        it("same-value write produces no event", () => {
            const state = objectRef({ health: 100 }, "player");
            const node = Action.from("noop", () => {
                state.health = 100;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
        });

        it("multiple field mutations produce separate events", () => {
            const state = objectRef({ health: 100, mana: 50 }, "player");
            const node = Action.from("update", () => {
                state.health = 80;
                state.mana = 30;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(2);
            expect(ctx.refEvents[0].fieldName).toBe("health");
            expect(ctx.refEvents[0].newValue).toBe(80);
            expect(ctx.refEvents[1].fieldName).toBe("mana");
            expect(ctx.refEvents[1].newValue).toBe(30);
        });

        it("mutation outside tick updates value without emitting event", () => {
            const state = objectRef({ health: 100 }, "player");

            state.health = 50;

            expect(state.health).toBe(50);
        });

        it("symbol-keyed writes produce no event", () => {
            const sym = Symbol("key");
            const state = objectRef({} as Record<symbol, number>, "player");
            const node = Action.from("sym", () => {
                state[sym] = 42;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(0);
            expect(state[sym]).toBe(42);
        });
    });

    describe("patchObjectRef", () => {
        it("traces plain field mutations on class instance", () => {
            class GameState {
                health = 100;
                get alive() { return this.health > 0; }
                heal(amount: number) { this.health += amount; }
            }

            const gs = patchObjectRef(new GameState(), "gs");
            const node = Action.from("update", () => {
                gs.health = 60;
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(node, ctx);

            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0]).toMatchObject({
                refName: "gs",
                fieldName: "health",
                newValue: 60,
            });
        });

        it("methods and getters work normally without TypeError", () => {
            class GameState {
                health = 100;
                get alive() { return this.health > 0; }
                heal(amount: number) { this.health += amount; }
            }

            const gs = patchObjectRef(new GameState(), "gs");

            expect(gs.alive).toBe(true);
            gs.health = 0;
            expect(gs.alive).toBe(false);
            gs.heal(50);
            expect(gs.health).toBe(50);
        });

        it("method call that mutates field inside tick traces the mutation", () => {
            class Counter {
                count = 0;
                increment() { this.count++; }
            }

            const c = patchObjectRef(new Counter(), "counter");
            const node = Action.from("inc", () => {
                c.increment();
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext({ tickId: 1, now: 0 });

            BTNode.Tick(node, ctx);

            expect(c.count).toBe(1);
            expect(ctx.refEvents).toHaveLength(1);
            expect(ctx.refEvents[0].fieldName).toBe("count");
            expect(ctx.refEvents[0].newValue).toBe(1);
        });
    });

    describe("DerivedRef", () => {
        it(".value recomputes from source refs on each access", () => {
            const a = ref(2, "a");
            const b = ref(3, "b");
            const sum = derivedRef(() => a.value + b.value, "sum");

            expect(sum.value).toBe(5);

            a.value = 10;
            expect(sum.value).toBe(13);

            b.value = 7;
            expect(sum.value).toBe(17);
        });

        it("produces no trace events", () => {
            const a = ref(1, "a");
            const d = derivedRef(() => a.value * 2, "double");

            const node = Action.from("read", () => {
                const _val = d.value; // read derived ref
                return NodeResult.Succeeded;
            });
            const ctx = createTickContext();

            BTNode.Tick(node, ctx);

            // Only reading derived ref — no events
            expect(ctx.refEvents).toHaveLength(0);
        });

        it(".name works", () => {
            const d = derivedRef(() => 42, "answer");
            expect(d.name).toBe("answer");

            const unnamed = derivedRef(() => 0);
            expect(unnamed.name).toBeUndefined();
        });
    });
});
