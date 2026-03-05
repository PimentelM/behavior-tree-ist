import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@behavior-tree-ist/studio-server';

export const trpc = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: '/trpc' })],
});
