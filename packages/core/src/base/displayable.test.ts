import { describe, it, expect } from "vitest";
import { isDisplayable, NodeResult, type RefChangeEvent } from "./types";
import { ref, proxyRef } from "./ref";
import { BTNode } from "./node";
import { Action } from "./action";
import { AmbientContext } from "./ambient-context";
import { createTickContext } from "../test-helpers";

describe("isDisplayable", () => {
    describe("falsy / primitive inputs", () => {
        it("returns false for null", () => {
            expect(isDisplayable(null)).toBe(false);
        });

        it("returns false for undefined", () => {
            expect(isDisplayable(undefined)).toBe(false);
        });

        it("returns false for number", () => {
            expect(isDisplayable(42)).toBe(false);
        });

        it("returns false for string", () => {
            expect(isDisplayable("hello")).toBe(false);
        });

        it("returns false for boolean", () => {
            expect(isDisplayable(true)).toBe(false);
        });
    });

    describe("object without toDisplayString", () => {
        it("returns false for plain empty object", () => {
            expect(isDisplayable({})).toBe(false);
        });

        it("returns false for array (no toDisplayString)", () => {
            expect(isDisplayable([])).toBe(false);
        });

        it("returns false for object with unrelated properties", () => {
            expect(isDisplayable({ name: "Bob", value: 42 })).toBe(false);
        });
    });

    describe("object with non-function toDisplayString", () => {
        it("returns false when toDisplayString is a string", () => {
            expect(isDisplayable({ toDisplayString: "not a function" })).toBe(false);
        });

        it("returns false when toDisplayString is a number", () => {
            expect(isDisplayable({ toDisplayString: 42 })).toBe(false);
        });

        it("returns false when toDisplayString is null", () => {
            expect(isDisplayable({ toDisplayString: null })).toBe(false);
        });

        it("returns false when toDisplayString is true", () => {
            expect(isDisplayable({ toDisplayString: true })).toBe(false);
        });

        it("returns false when toDisplayString is an array", () => {
            expect(isDisplayable({ toDisplayString: [] })).toBe(false);
        });

        it("returns false when toDisplayString is an object", () => {
            expect(isDisplayable({ toDisplayString: {} })).toBe(false);
        });
    });

    describe("valid Displayable", () => {
        it("returns true for plain object with toDisplayString function", () => {
            expect(isDisplayable({ toDisplayString: () => "ok" })).toBe(true);
        });

        it("returns true for class instance with toDisplayString", () => {
            class Entity {
                toDisplayString(): string { return "Entity"; }
            }
            expect(isDisplayable(new Entity())).toBe(true);
        });

        it("returns true even when toDisplayString would throw (checks shape only)", () => {
            expect(isDisplayable({ toDisplayString: () => { throw new Error("boom"); } })).toBe(true);
        });
    });
});

describe("newValue / displayValue mutual exclusivity — ValueRef", () => {
    class DisplayableEntity {
        constructor(public label: string) {}
        toDisplayString(): string { return `Entity(${this.label})`; }
    }

    it("Displayable value: event has displayValue, newValue absent", () => {
        const r = ref(new DisplayableEntity("start"), "entity");
        const node = Action.from("update", () => {
            r.value = new DisplayableEntity("end");
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.displayValue).toBe("Entity(end)");
        expect("newValue" in event).toBe(false);
    });

    it("non-Displayable primitive: event has newValue, displayValue absent", () => {
        const r = ref(0, "counter");
        const node = Action.from("inc", () => {
            r.value = 99;
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.newValue).toBe(99);
        expect("displayValue" in event).toBe(false);
    });

    it("null value: treated as non-Displayable, emits newValue: null", () => {
        const r = ref<string | null>("hello", "nullable");
        const node = Action.from("clear", () => {
            r.value = null;
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.newValue).toBeNull();
        expect("displayValue" in event).toBe(false);
    });

    it("transitioning from Displayable to primitive: emits newValue for new primitive", () => {
        const r = ref<DisplayableEntity | number>(new DisplayableEntity("x"), "mixed");
        const node = Action.from("transition", () => {
            r.value = 42;
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.newValue).toBe(42);
        expect("displayValue" in event).toBe(false);
    });

    it("transitioning from primitive to Displayable: emits displayValue", () => {
        const r = ref<number | DisplayableEntity>(0, "mixed");
        const node = Action.from("transition", () => {
            r.value = new DisplayableEntity("orc");
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.displayValue).toBe("Entity(orc)");
        expect("newValue" in event).toBe(false);
    });
});

describe("newValue / displayValue mutual exclusivity — ProxyRef", () => {
    class DisplayableEntity {
        constructor(public label: string) {}
        toDisplayString(): string { return `Entity(${this.label})`; }
    }

    it("Displayable value: event has displayValue, newValue absent", () => {
        let store: DisplayableEntity = new DisplayableEntity("start");
        const p = proxyRef(() => store, (v) => { store = v; }, "entity");
        const node = Action.from("update", () => {
            p.value = new DisplayableEntity("end");
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 2, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.displayValue).toBe("Entity(end)");
        expect("newValue" in event).toBe(false);
    });

    it("non-Displayable primitive: event has newValue, displayValue absent", () => {
        let store = 0;
        const p = proxyRef(() => store, (v) => { store = v; }, "num");
        const node = Action.from("set", () => {
            p.value = 7;
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 2, now: 0 });

        BTNode.Tick(node, ctx);

        const event = ctx.refEvents[0] as RefChangeEvent;
        expect(event.newValue).toBe(7);
        expect("displayValue" in event).toBe(false);
    });
});

describe("throwing toDisplayString", () => {
    class ThrowingDisplayable {
        private _id: number;
        constructor(id: number) { this._id = id; }
        toDisplayString(): string { throw new Error(`display failed: ${this._id}`); }
    }

    it("ValueRef: throws propagates out of set()", () => {
        const r = ref(new ThrowingDisplayable(1), "entity");
        const node = Action.from("update", () => {
            r.value = new ThrowingDisplayable(2);
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        expect(() => BTNode.Tick(node, ctx)).toThrow("display failed: 2");
    });

    it("ValueRef: ambient context is clean after throw", () => {
        const r = ref(new ThrowingDisplayable(1), "entity");
        const node = Action.from("update", () => {
            r.value = new ThrowingDisplayable(2);
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 1, now: 0 });

        expect(() => BTNode.Tick(node, ctx)).toThrow();
        expect(AmbientContext.getTickContext()).toBeUndefined();
    });

    it("ValueRef: next tick after throw works correctly", () => {
        const r = ref(new ThrowingDisplayable(1), "entity");
        const explosiveNode = Action.from("explode", () => {
            r.value = new ThrowingDisplayable(2);
            return NodeResult.Succeeded;
        });
        expect(() => BTNode.Tick(explosiveNode, createTickContext())).toThrow();

        const counter = ref(0, "counter");
        const safeNode = Action.from("ok", () => {
            counter.value = 99;
            return NodeResult.Succeeded;
        });
        const ctx2 = createTickContext({ tickId: 2, now: 100 });
        BTNode.Tick(safeNode, ctx2);

        expect(ctx2.refEvents).toHaveLength(1);
        expect((ctx2.refEvents[0] as RefChangeEvent).newValue).toBe(99);
    });

    it("ProxyRef: throwing toDisplayString propagates out of set()", () => {
        let store: ThrowingDisplayable = new ThrowingDisplayable(1);
        const p = proxyRef(() => store, (v) => { store = v; }, "entity");
        const node = Action.from("update", () => {
            p.value = new ThrowingDisplayable(2);
            return NodeResult.Succeeded;
        });
        const ctx = createTickContext({ tickId: 3, now: 0 });

        expect(() => BTNode.Tick(node, ctx)).toThrow("display failed: 2");
    });

    it("ProxyRef: ambient context is clean after throw", () => {
        let store: ThrowingDisplayable = new ThrowingDisplayable(1);
        const p = proxyRef(() => store, (v) => { store = v; }, "entity");
        const node = Action.from("update", () => {
            p.value = new ThrowingDisplayable(2);
            return NodeResult.Succeeded;
        });

        expect(() => BTNode.Tick(node, createTickContext())).toThrow();
        expect(AmbientContext.getTickContext()).toBeUndefined();
    });
});

describe("isDisplayable type narrowing", () => {
    it("narrows unknown to Displayable in conditional", () => {
        const val: unknown = { toDisplayString: () => "narrowed" };

        if (isDisplayable(val)) {
            expect(val.toDisplayString()).toBe("narrowed");
        } else {
            expect.fail("should have been narrowed to Displayable");
        }
    });

    it("does not narrow non-Displayable", () => {
        const val: unknown = { name: "no display" };
        expect(isDisplayable(val)).toBe(false);
    });
});
