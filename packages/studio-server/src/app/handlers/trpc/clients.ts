import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { AppDependencies } from '../../../types/app-dependencies';

export function createClientsRouter({ clientRepository, agentConnectionRegistry }: AppDependencies) {
    return router({
        getAll: procedure.query(async () => {
            const clients = await clientRepository.findAll();
            return clients.map(c => ({
                ...c,
                online: agentConnectionRegistry.getAllConnections().some(conn => conn.clientId === c.clientId),
            }));
        }),

        getById: procedure
            .input(z.object({ clientId: z.string() }))
            .query(async ({ input }) => {
                const client = await clientRepository.findById(input.clientId);
                if (!client) return null;
                return {
                    ...client,
                    online: agentConnectionRegistry.getAllConnections().some(conn => conn.clientId === client.clientId),
                };
            }),
    });
}
