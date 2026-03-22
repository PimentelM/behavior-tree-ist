import { describe, it, expect, afterEach } from "vitest";
import { tickMemo } from "./tick-memo";
import { BehaviourTree } from "../tree";
import { Action } from "./action";
import { NodeResult } from "./types";

afterEach(() => {
    BehaviourTree.setTickIdentity(null);
});

describe("tickMemo — zero args", () => {
    it("executes fn once per tick", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);
        const tree = new BehaviourTree(Action.from("a", () => { memo(); memo(); return NodeResult.Succeeded; }));

        tree.tick();

        expect(calls).toBe(1);
    });

    it("returns cached value within a tick", () => {
        const results: number[] = [];
        let counter = 0;
        const memo = tickMemo(() => ++counter);
        const tree = new BehaviourTree(Action.from("a", () => {
            results.push(memo());
            results.push(memo());
            return NodeResult.Succeeded;
        }));

        tree.tick();

        expect(results).toEqual([1, 1]);
    });

    it("invalidates cache between ticks", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);
        const tree = new BehaviourTree(Action.from("a", () => { memo(); return NodeResult.Succeeded; }));

        tree.tick();
        tree.tick();

        expect(calls).toBe(2);
    });

    it("pass-through when called outside tick with no setTickIdentity", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);

        memo();
        memo();

        expect(calls).toBe(2);
    });
});

describe("tickMemo — with args (=== comparison)", () => {
    it("caches by arg value", () => {
        let calls = 0;
        const memo = tickMemo((x: number) => { calls++; return x * 2; });
        const results: number[] = [];

        const tree = new BehaviourTree(Action.from("a", () => {
            results.push(memo(1));
            results.push(memo(1));
            results.push(memo(2));
            results.push(memo(2));
            return NodeResult.Succeeded;
        }));

        tree.tick();

        expect(calls).toBe(2);
        expect(results).toEqual([2, 2, 4, 4]);
    });

    it("distinguishes different args", () => {
        let calls = 0;
        const memo = tickMemo((x: number, y: number) => { calls++; return x + y; });
        const results: number[] = [];

        const tree = new BehaviourTree(Action.from("a", () => {
            results.push(memo(1, 2));
            results.push(memo(1, 3));
            results.push(memo(1, 2));
            return NodeResult.Succeeded;
        }));

        tree.tick();

        expect(calls).toBe(2);
        expect(results).toEqual([3, 4, 3]);
    });

    it("uses === not deep equality", () => {
        let calls = 0;
        const obj = { id: 1 };
        const memo = tickMemo((o: object) => { calls++; return o; });

        const tree = new BehaviourTree(Action.from("a", () => {
            memo(obj);
            memo(obj);
            memo({ id: 1 }); // different reference
            return NodeResult.Succeeded;
        }));

        tree.tick();

        expect(calls).toBe(2);
    });

    it("invalidates parameterized cache between ticks", () => {
        let calls = 0;
        const memo = tickMemo((x: number) => { calls++; return x; });
        const tree = new BehaviourTree(Action.from("a", () => { memo(1); return NodeResult.Succeeded; }));

        tree.tick();
        tree.tick();

        expect(calls).toBe(2);
    });
});

describe("tickMemo — independent closures", () => {
    it("two tickMemo calls have separate caches", () => {
        let callsA = 0, callsB = 0;
        const memoA = tickMemo(() => ++callsA);
        const memoB = tickMemo(() => ++callsB);

        const tree = new BehaviourTree(Action.from("a", () => {
            memoA(); memoA();
            memoB(); memoB();
            return NodeResult.Succeeded;
        }));

        tree.tick();

        expect(callsA).toBe(1);
        expect(callsB).toBe(1);
    });
});

describe("BehaviourTree.setTickIdentity", () => {
    it("shared cache across trees in same game frame", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);

        let frame = 0;
        BehaviourTree.setTickIdentity(() => frame);

        const treeA = new BehaviourTree(Action.from("a", () => { memo(); return NodeResult.Succeeded; }));
        const treeB = new BehaviourTree(Action.from("b", () => { memo(); return NodeResult.Succeeded; }));

        treeA.tick();
        treeB.tick();

        expect(calls).toBe(1);

        frame = 1;
        treeA.tick();

        expect(calls).toBe(2);
    });

    it("different trees use separate caches without setTickIdentity", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);

        const treeA = new BehaviourTree(Action.from("a", () => { memo(); return NodeResult.Succeeded; }));
        const treeB = new BehaviourTree(Action.from("b", () => { memo(); return NodeResult.Succeeded; }));

        treeA.tick();
        treeB.tick();

        expect(calls).toBe(2);
    });

    it("setTickIdentity(null) reverts to per-tree scoping", () => {
        let calls = 0;
        const frame = 0;
        const memo = tickMemo(() => ++calls);

        BehaviourTree.setTickIdentity(() => frame);

        const treeA = new BehaviourTree(Action.from("a", () => { memo(); return NodeResult.Succeeded; }));
        const treeB = new BehaviourTree(Action.from("b", () => { memo(); return NodeResult.Succeeded; }));

        treeA.tick();
        treeB.tick();
        expect(calls).toBe(1);

        BehaviourTree.setTickIdentity(null);
        calls = 0;

        treeA.tick();
        treeB.tick();
        expect(calls).toBe(2);
    });

    it("getter returning string works", () => {
        let calls = 0;
        const memo = tickMemo(() => ++calls);

        BehaviourTree.setTickIdentity(() => "frame-42");

        const treeA = new BehaviourTree(Action.from("a", () => { memo(); return NodeResult.Succeeded; }));
        const treeB = new BehaviourTree(Action.from("b", () => { memo(); return NodeResult.Succeeded; }));

        treeA.tick();
        treeB.tick();

        expect(calls).toBe(1);
    });
});
