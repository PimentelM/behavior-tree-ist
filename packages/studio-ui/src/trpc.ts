import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@bt-studio/studio-server';

export const trpc = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: '/trpc' })],
});
