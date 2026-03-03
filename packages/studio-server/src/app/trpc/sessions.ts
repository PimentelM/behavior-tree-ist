import { z } from 'zod';
import { router, procedure } from './trpc-setup';
import { AppDependencies } from '../../types/app-dependencies';

export function createSessionsRouter({ sessionRepository, agentConnectionRegistry }: AppDependencies) {
    return router({
        getByClientId: procedure
            .input(z.object({ clientId: z.string() }))
            .query(async ({ input }) => {
                const sessions = await sessionRepository.findByClientId(input.clientId);
                return sessions.map(s => ({
                    ...s,
                    online: agentConnectionRegistry.isOnline(s.clientId, s.sessionId),
                }));
            }),
    });
}
