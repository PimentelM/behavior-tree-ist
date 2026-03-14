import { type TickContext } from "./node";

export type UtilityScorer = (ctx: TickContext) => number;
