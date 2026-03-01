import { useState, useCallback } from 'react';
import type { StudioCommandResult } from '@behavior-tree-ist/react';
import { trpc } from '../trpc-client';

export function useStudioCommands() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const sendCommand = useCallback(
        async (command: string, treeId: string, clientId: string | null): Promise<StudioCommandResult> => {
            if (!clientId) {
                return { success: false, errorMessage: 'No client selected' };
            }

            setIsPending(true);
            setError(null);
            try {
                if (command === 'enable-streaming') {
                    await trpc.enableStreaming.mutate({ clientId, treeId });
                } else if (command === 'disable-streaming') {
                    await trpc.disableStreaming.mutate({ clientId, treeId });
                } else {
                    throw new Error(`Command not yet implemented in backend: ${command}`);
                }

                return {
                    success: true,
                };
            } catch (e) {
                const err = e instanceof Error ? e : new Error('Command failed');
                setError(err);
                return {
                    success: false,
                    errorMessage: err.message,
                };
            } finally {
                setIsPending(false);
            }
        },
        []
    );

    return { sendCommand, isPending, error };
}
