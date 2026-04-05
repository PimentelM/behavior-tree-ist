import { describe, expect, it, vi } from 'vitest';
import type { AppRouter } from '@bt-studio/studio-server';
import type { TRPCClient } from '@trpc/client';
import { handleQueryLogs } from './tools';

describe('handleQueryLogs', () => {
    it('formats log pages and next cursor', async () => {
        const trpc = {
            logs: {
                query: {
                    query: vi.fn().mockResolvedValue({
                        items: [{
                            id: 2,
                            clientId: 'client-1',
                            sessionId: 'session-1',
                            timestamp: 100,
                            level: 1,
                            event: 'Warn',
                            message: 'careful',
                        }],
                        nextCursor: 2,
                    }),
                },
            },
        } as unknown as TRPCClient<AppRouter>;

        const result = await handleQueryLogs(trpc, { clientId: 'client-1' });
        const text = result.content[0];

        expect(text?.type).toBe('text');
        expect(text && 'text' in text ? text.text : '').toContain('[WARN] Warn: careful');
        expect(text && 'text' in text ? text.text : '').toContain('nextCursor=2');
    });

    it('handles empty results', async () => {
        const trpc = {
            logs: {
                query: {
                    query: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
                },
            },
        } as unknown as TRPCClient<AppRouter>;

        const result = await handleQueryLogs(trpc, { clientId: 'client-1' });
        const text = result.content[0];
        expect(text && 'text' in text ? text.text : '').toBe('No logs found.');
    });
});
