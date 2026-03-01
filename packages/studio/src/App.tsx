import { useState, useCallback } from 'react';
import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import { useStudioPolling } from './ui/hooks/useStudioPolling';
import { useStudioCommands } from './ui/hooks/useStudioCommands';
import { useLocalPersistence } from './ui/hooks/useLocalPersistence';
import { SettingsPanel } from './ui/components/SettingsPanel';
import type { ThemeMode } from '@behavior-tree-ist/react';

function App() {
    const [themeMode, setThemeMode] = useLocalPersistence<ThemeMode>('bt-studio:theme', 'dark');
    const [selectedClientId, setSelectedClientId] = useLocalPersistence<string | null>('bt-studio:clientId', null);
    const [selectedTreeId, setSelectedTreeId] = useLocalPersistence<string | null>('bt-studio:treeId', null);
    const [pollingInterval, setPollingInterval] = useLocalPersistence<number>('bt-studio:pollingInterval', 500);
    const [tickFetchLimit, setTickFetchLimit] = useLocalPersistence<number>('bt-studio:tickFetchLimit', 200);

    // Settings Panel State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Polling Hook
    const { clients, trees, rawTree, ticks, serverSettings, error: pollingError } = useStudioPolling(
        selectedClientId,
        selectedTreeId,
        { intervalMs: pollingInterval, tickFetchLimit }
    );

    // Commands Hook
    const { sendCommand } = useStudioCommands();

    // Selected Client specific states
    const selectedClient = clients.find(c => c.clientId === selectedClientId);
    const isClientOnline = selectedClient?.isOnline ?? false;
    // Let's assume the client is live if it's online. In a more complex scenario, this could check if ticks are actively arriving.
    const isLive = isClientOnline;

    // We could implement optimistic updates for toggle states or rely on server state if the server starts responding with it
    // For now, we mock them enabled/disabled, or maintain local optimisitic state
    const [streamingEnabled, setStreamingEnabled] = useState(true);
    const [stateTraceEnabled, setStateTraceEnabled] = useState(false);
    const [profilingEnabled, setProfilingEnabled] = useState(false);

    const handleSendCommand = useCallback(async (command: string, treeId: string) => {
        // Optimistic updates
        if (command === 'enable-streaming') setStreamingEnabled(true);
        if (command === 'disable-streaming') setStreamingEnabled(false);
        if (command === 'enable-state-trace') setStateTraceEnabled(true);
        if (command === 'disable-state-trace') setStateTraceEnabled(false);
        if (command === 'enable-profiling') setProfilingEnabled(true);
        if (command === 'disable-profiling') setProfilingEnabled(false);

        const result = await sendCommand(command, treeId, selectedClientId);

        // Rollback on failure could be implemented here
        if (!result.success) {
            console.error("Command failed:", result.errorMessage);
        }

        return result;
    }, [sendCommand, selectedClientId]);

    // Derived properties for BehaviourTreeDebugger
    const treeToRender = rawTree?.serializedTree;

    // Server-side settings
    const maxTickRecordsPerTree = serverSettings?.maxTickRecordsPerTree ?? 10000;

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                {pollingError && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, background: 'var(--bt-color-failed, red)', color: 'white', padding: '8px', textAlign: 'center' }}>
                        Error connecting to Studio Server: {pollingError.message}
                    </div>
                )}

                <BehaviourTreeDebugger
                    tree={treeToRender}
                    ticks={ticks}
                    isolateStyles={true}
                    themeMode={themeMode}
                    onThemeModeChange={(mode) => setThemeMode(mode)}
                    studio={{
                        clients,
                        trees,
                        selectedClientId,
                        selectedTreeId,
                        onSelectClient: setSelectedClientId,
                        onSelectTree: setSelectedTreeId,
                        onSendCommand: handleSendCommand,
                        streamingEnabled,
                        stateTraceEnabled,
                        profilingEnabled,
                        isClientOnline,
                        isLive,
                        onOpenSettings: () => setIsSettingsOpen(true),
                    }}
                    inspectorOptions={{
                        // Convert max server records back to buffer time/ticks or just allow maximum
                        maxTicks: maxTickRecordsPerTree,
                    }}
                />

                {/* Settings Panel Drawer */}
                {isSettingsOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, bottom: 0, right: 0,
                            width: '320px',
                            zIndex: 9999,
                            boxShadow: '-4px 0 16px rgba(0,0,0,0.2)'
                        }}
                    >
                        <SettingsPanel
                            onClose={() => setIsSettingsOpen(false)}
                            pollingInterval={pollingInterval}
                            onPollingIntervalChange={setPollingInterval}
                            tickFetchLimit={tickFetchLimit}
                            onTickFetchLimitChange={setTickFetchLimit}
                            maxTickRecordsPerTree={maxTickRecordsPerTree}
                            onMaxTickRecordsPerTreeChange={(val) => {
                                // In a complete implementation, we'd also trigger an updateSettings mutation here.
                                console.log("Saving new server max ticks:", val);
                            }}
                            themeMode={themeMode}
                            onThemeModeChange={setThemeMode}
                        />
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
