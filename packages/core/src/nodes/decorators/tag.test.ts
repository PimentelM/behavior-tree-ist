import { expect, test } from "vitest";
import { Action } from "../../base";
import { Tag } from "./tag";
import { NodeResult } from "../../base";
import { Inverter } from "./inverter";

test("Tag decorator adds tags and returns the original node", () => {
    const action = Action.from("MyAction", () => NodeResult.Succeeded);
    expect(action.tags).toEqual([]);

    const tagged = new Tag(action, "tag1", "tag2") as unknown as Action;
    expect(tagged).toBe(action);
    expect(tagged.tags).toEqual(["tag1", "tag2"]);

    // Duplicates are ignored
    const taggedAgain = new Tag(tagged, "tag2", "tag3") as unknown as Action;
    expect(taggedAgain).toBe(action);
    expect(taggedAgain.tags).toEqual(["tag1", "tag2", "tag3"]);
});

test("Decorators transparently forward tags to their child nodes", () => {
    const action = Action.from("MyAction", () => NodeResult.Succeeded);
    const decorator = new Inverter(action);

    decorator.addTags(["forwarded"]);

    // Decorator itself has no tags
    expect(decorator.tags).toEqual([]);
    // Because it proxies directly to the child
    expect(action.tags).toEqual(["forwarded"]);
});
