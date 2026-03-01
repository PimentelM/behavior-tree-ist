import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/app/router';

export function createStudioTRPCClient(baseUrl: string) {
    return createTRPCClient<AppRouter>({
        links: [
            httpBatchLink({
                url: `${baseUrl}/trpc`,
                headers() {
                    return {
                        authorization: 'dev-web-token',
                    };
                }
            }),
        ],
    });
}

const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    if (process.env.FROST_SERVER_URL) return process.env.FROST_SERVER_URL;
    return 'http://localhost:3000';
};

export const trpc = createStudioTRPCClient(getBaseUrl());
