import type { TickContext } from "./node";
import type { RefChangeEvent } from "./types";

export function pushRefEvent(ctx: TickContext, event: RefChangeEvent): void {
    const runtime = ctx.runtime;
    if (runtime) {
        if (runtime.isTickRunning) {
            (runtime.latest as TickContext).refEvents.push(event);
        } else {
            runtime.pendingRefEvents.push(event);
        }
    } else {
        ctx.refEvents.push(event);
    }
}
