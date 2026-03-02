import { useState, useCallback } from 'react';
import type { StudioCommandResult } from '@behavior-tree-ist/react';
import { trpc } from '../trpc-client';

const SUPPORTED_COMMANDS = new Set([
    'enable-streaming',
    'disable-streaming',
    'enable-state-trace',
    'disable-state-trace',
    'enable-profiling',
    'disable-profiling',
] as const);

type SupportedCommand =
    | 'enable-streaming'
    | 'disable-streaming'
    | 'enable-state-trace'
    | 'disable-state-trace'
    | 'enable-profiling'
    | 'disable-profiling';

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
                if (!SUPPORTED_COMMANDS.has(command as SupportedCommand)) {
                    throw new Error(`Unsupported command: ${command}`);
                }

                const result = await trpc.sendCommand.mutate({
                    clientId,
                    treeId,
                    command: command as SupportedCommand,
                });
                if (!result.success) {
                    setError(new Error(result.errorMessage ?? 'Command failed'));
                    return {
                        success: false,
                        errorCode: result.errorCode,
                        errorMessage: result.errorMessage ?? 'Command failed',
                    };
                }
                return result;
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
