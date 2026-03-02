import { describe, it, expect } from "vitest";
import { isValidTreeId } from "./validation";

describe("validation", () => {
    describe("isValidTreeId", () => {
        it("should accept alphanumeric keys with symbols _-:./@", () => {
            expect(isValidTreeId("my-tree")).toBe(true);
            expect(isValidTreeId("tree_1")).toBe(true);
            expect(isValidTreeId("AbC123")).toBe(true);
            expect(isValidTreeId("a")).toBe(true);
            expect(isValidTreeId("A-B_c-1")).toBe(true);
            expect(isValidTreeId("a:b:c")).toBe(true);
            expect(isValidTreeId("tree/slash")).toBe(true);
            expect(isValidTreeId("tree.dot")).toBe(true);
            expect(isValidTreeId("tree@at")).toBe(true);
        });

        it("rejects invalid keys", () => {
            expect(isValidTreeId("tree with space")).toBe(false);
            expect(isValidTreeId("")).toBe(false);
            expect(isValidTreeId("café")).toBe(false);
        });
    });
});
