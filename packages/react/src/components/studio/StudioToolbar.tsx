import type { StudioProps, ThemeMode } from '../../types';
import { ClientTreeSelector } from './ClientTreeSelector';

export interface StudioToolbarProps {
    studio: StudioProps;
    themeMode: ThemeMode;
}

export function StudioToolbar({ studio }: StudioToolbarProps) {
    const {
        clients,
        selectedClientId,
        selectedTreeId,
        trees,
        onSelectClient,
        onSelectTree,
        onSendCommand,
        streamingEnabled,
        stateTraceEnabled,
        profilingEnabled,
        isClientOnline,
        isLive,
        onOpenSettings,
    } = studio;

    const handleToggleStreaming = () => {
        if (!selectedTreeId) return;
        const command = streamingEnabled ? 'disable-streaming' : 'enable-streaming';
        onSendCommand(command, selectedTreeId);
    };

    const handleToggleStateTrace = () => {
        if (!selectedTreeId) return;
        const command = stateTraceEnabled ? 'disable-state-trace' : 'enable-state-trace';
        onSendCommand(command, selectedTreeId);
    };

    const handleToggleProfiling = () => {
        if (!selectedTreeId) return;
        const command = profilingEnabled ? 'disable-profiling' : 'enable-profiling';
        onSendCommand(command, selectedTreeId);
    };

    return (
        <div className="bt-studio-toolbar">
            <ClientTreeSelector
                clients={clients}
                trees={trees}
                selectedClientId={selectedClientId}
                selectedTreeId={selectedTreeId}
                onSelectClient={onSelectClient}
                onSelectTree={onSelectTree}
            />

            {selectedTreeId && (
                <div className="bt-studio-toolbar__controls">
                    <div className="bt-studio-toolbar__status">
                        <span className={`bt-studio-status-indicator bt-studio-status-indicator--${isClientOnline ? 'online' : 'offline'}`} title={isClientOnline ? 'Client Online' : 'Client Offline'} />
                        <span className="bt-studio-status-text">
                            {isClientOnline ? 'Online' : 'Offline'}
                        </span>
                        <span className={`bt-badge bt-badge--${isLive ? 'live' : 'stale'}`}>
                            {isLive ? 'LIVE' : 'STALE'}
                        </span>
                    </div>

                    <div className="bt-studio-toolbar__divider" />

                    <button
                        type="button"
                        className={`bt-toolbar-btn ${streamingEnabled ? 'bt-toolbar-btn--active' : ''}`}
                        onClick={handleToggleStreaming}
                        disabled={!isClientOnline}
                        title={streamingEnabled ? 'Pause Streaming' : 'Start Streaming'}
                    >
                        {streamingEnabled ? '⏸' : '▶'} Stream
                    </button>

                    <button
                        type="button"
                        className={`bt-toolbar-btn ${stateTraceEnabled ? 'bt-toolbar-btn--active' : ''}`}
                        onClick={handleToggleStateTrace}
                        disabled={!isClientOnline}
                        title={stateTraceEnabled ? 'Disable State Trace' : 'Enable State Trace'}
                    >
                        📋 Trace
                    </button>

                    <button
                        type="button"
                        className={`bt-toolbar-btn ${profilingEnabled ? 'bt-toolbar-btn--active' : ''}`}
                        onClick={handleToggleProfiling}
                        disabled={!isClientOnline}
                        title={profilingEnabled ? 'Disable Profiling' : 'Enable Profiling'}
                    >
                        ⏱ Profile
                    </button>

                    {onOpenSettings && (
                        <>
                            <div className="bt-studio-toolbar__divider" />
                            <button
                                type="button"
                                className="bt-toolbar-btn"
                                onClick={onOpenSettings}
                                title="Open Settings"
                            >
                                ⚙
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
