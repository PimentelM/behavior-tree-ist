import { expect, test } from "vitest";
import { Action, NodeResult } from "../../base";
import { Inverter } from "./inverter";
import { Activity } from "./activity";

test("Activity decorator sets activity and returns the original node", () => {
    const action = Action.from("MyAction", () => NodeResult.Succeeded);
    expect(action.activity).toBeUndefined();

    const withActivity = new Activity(action, "Patrolling") as unknown as Action;
    expect(withActivity).toBe(action);
    expect(withActivity.activity).toBe("Patrolling");

    const replaced = new Activity(withActivity, "Kiting") as unknown as Action;
    expect(replaced).toBe(action);
    expect(replaced.activity).toBe("Kiting");

    const withDefaultLabel = new Activity(replaced, true) as unknown as Action;
    expect(withDefaultLabel).toBe(action);
    expect(withDefaultLabel.activity).toBe(true);
});

test("Decorators transparently forward activity to their child nodes", () => {
    const action = Action.from("MyAction", () => NodeResult.Succeeded);
    const decorator = new Inverter(action);

    decorator.setActivity("Attacking");

    expect(decorator.activity).toBeUndefined();
    expect(action.activity).toBe("Attacking");
});
