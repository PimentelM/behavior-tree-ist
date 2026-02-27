/* eslint-disable @typescript-eslint/no-unused-vars */
import { BT } from "./index";
import { NodeResult, TickContext } from "../base";



export function createHeroSubtree(heroName: string) {
    return (
        <sequence name={`${heroName} Subtree`}>
            <condition name="Is Alive" eval={() => true} />
            <action name="Attack" execute={() => NodeResult.Succeeded} />
        </sequence>
    );
}
