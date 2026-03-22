import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@bt-studio/studio-server';

export const trpc = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: '/trpc' })],
});

/**
 * Cast a tRPC procedure's .query method to an explicit typed callable.
 * Needed to avoid TS2589 (type instantiation too deep) for procedures whose
 * output schema contains recursive types (e.g. TickRecord → SerializableValue).
 * fn must be unknown so TypeScript does not evaluate the deep tRPC proc type.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function asProcedure<TIn, TOut>(fn: unknown): (input: TIn) => Promise<TOut> {
    return fn as (input: TIn) => Promise<TOut>;
}
