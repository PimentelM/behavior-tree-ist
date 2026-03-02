export interface SettingsPanelProps {
    onClose: () => void;
    pollingInterval: number;
    onPollingIntervalChange: (interval: number) => void;
    tickFetchLimit: number;
    onTickFetchLimitChange: (limit: number) => void;
    maxTickRecordsPerTree: number;
    onMaxTickRecordsPerTreeChange: (max: number) => void;
    themeMode: 'light' | 'dark';
    onThemeModeChange: (mode: 'light' | 'dark') => void;
}

export function SettingsPanel({
    onClose,
    pollingInterval,
    onPollingIntervalChange,
    tickFetchLimit,
    onTickFetchLimitChange,
    maxTickRecordsPerTree,
    onMaxTickRecordsPerTreeChange,
    themeMode,
    onThemeModeChange,
}: SettingsPanelProps) {
    return (
        <div className="bt-settings-panel" style={{ padding: '16px', background: 'var(--bt-bg-primary)', color: 'var(--bt-text-primary)', borderLeft: '1px solid var(--bt-border-color)', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Studio Settings</h2>
                <button onClick={onClose} style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--bt-text-primary)' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--bt-text-secondary)', fontWeight: 600 }}>Theme Mode</label>
                    <select
                        value={themeMode}
                        onChange={(e) => onThemeModeChange(e.target.value as 'light' | 'dark')}
                        style={{ padding: '4px', background: 'var(--bt-bg-secondary)', color: 'var(--bt-text-primary)', border: '1px solid var(--bt-border-color)', borderRadius: '4px' }}
                    >
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--bt-text-secondary)', fontWeight: 600 }}>Polling Interval (ms)</label>
                    <input
                        type="number"
                        value={pollingInterval}
                        onChange={(e) => onPollingIntervalChange(Number(e.target.value))}
                        min={100}
                        step={100}
                        style={{ padding: '4px', background: 'var(--bt-bg-secondary)', color: 'var(--bt-text-primary)', border: '1px solid var(--bt-border-color)', borderRadius: '4px' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--bt-text-secondary)', fontWeight: 600 }}>Tick Fetch Limit (per poll)</label>
                    <input
                        type="number"
                        value={tickFetchLimit}
                        onChange={(e) => onTickFetchLimitChange(Number(e.target.value))}
                        min={10}
                        step={10}
                        style={{ padding: '4px', background: 'var(--bt-bg-secondary)', color: 'var(--bt-text-primary)', border: '1px solid var(--bt-border-color)', borderRadius: '4px' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--bt-text-secondary)', fontWeight: 600 }}>Server: Max Tick Records Per Tree</label>
                    <input
                        type="number"
                        value={maxTickRecordsPerTree}
                        onChange={(e) => onMaxTickRecordsPerTreeChange(Number(e.target.value))}
                        min={100}
                        step={100}
                        style={{ padding: '4px', background: 'var(--bt-bg-secondary)', color: 'var(--bt-text-primary)', border: '1px solid var(--bt-border-color)', borderRadius: '4px' }}
                    />
                </div>
            </div>
        </div>
    );
}
