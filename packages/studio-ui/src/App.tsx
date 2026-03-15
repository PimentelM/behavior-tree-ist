import { useState } from 'react';
import { BehaviourTreeDebugger } from '@bt-studio/react';
import type { SerializableNode } from '@bt-studio/core';
import { useStudioControls } from './use-studio-controls';
import { ReplTerminal } from './repl';

const PLACEHOLDER_TREE: SerializableNode = {
    id: 0,
    nodeFlags: 0,
    defaultName: 'No tree selected',
    name: 'No tree selected',
};

const emptyPanels = {
    nodeDetails: false as const,
    timeline: false as const,
    refTraces: false as const,
    activityNow: false as const,
    performance: false as const,
};

const onboardingContent = (
    <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--bt-text-secondary)' }}>
            No tree connected
        </p>
        <p style={{ fontSize: 13, margin: 0, color: 'var(--bt-text-muted)' }}>
            Click <strong>Attach</strong> to connect to a running agent
        </p>
    </div>
);

type AppView = 'debugger' | 'repl';

// Terminal icon SVG (inline, no external deps)
function TerminalIcon({ size = 16 }: { size?: number }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
    );
}

const TAB_BAR_HEIGHT = 32;

function App() {
    const { studioControls, tree, ticks } = useStudioControls();
    const [view, setView] = useState<AppView>('debugger');
    const isEmpty = tree === null;

    const clientId = studioControls.selection?.clientId ?? null;
    const sessionId = studioControls.selection?.sessionId ?? null;

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tab bar */}
            <div
                style={{
                    height: TAB_BAR_HEIGHT,
                    display: 'flex',
                    alignItems: 'stretch',
                    background: '#150010',
                    borderBottom: '1px solid #3a1032',
                    flexShrink: 0,
                    paddingLeft: 4,
                    gap: 2,
                }}
            >
                <button
                    onClick={() => setView('debugger')}
                    title="Debugger view"
                    style={{
                        background: view === 'debugger' ? '#300a24' : 'transparent',
                        border: 'none',
                        borderBottom: view === 'debugger' ? '2px solid #8ae234' : '2px solid transparent',
                        color: view === 'debugger' ? '#eeeeec' : '#555753',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '0 14px',
                        fontFamily: 'Ubuntu Mono, monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Debugger
                </button>
                <button
                    onClick={() => setView('repl')}
                    title="REPL terminal view"
                    style={{
                        background: view === 'repl' ? '#300a24' : 'transparent',
                        border: 'none',
                        borderBottom: view === 'repl' ? '2px solid #8ae234' : '2px solid transparent',
                        color: view === 'repl' ? '#8ae234' : '#555753',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '0 14px',
                        fontFamily: 'Ubuntu Mono, monospace',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <TerminalIcon size={14} />
                    Terminal
                </button>
            </div>

            {/* View content */}
            <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                {view === 'debugger' ? (
                    <BehaviourTreeDebugger
                        tree={tree ?? PLACEHOLDER_TREE}
                        ticks={ticks}
                        isolateStyles={true}
                        inspectorOptions={{
                            maxTicks: studioControls.windowMaxTicks ?? studioControls.uiSettings.ringBufferSize,
                        }}
                        studioControls={studioControls}
                        panels={isEmpty ? emptyPanels : undefined}
                        emptyState={isEmpty ? onboardingContent : undefined}
                    />
                ) : (
                    <ReplTerminal clientId={clientId} sessionId={sessionId} />
                )}
            </main>
        </div>
    );
}

export default App;
