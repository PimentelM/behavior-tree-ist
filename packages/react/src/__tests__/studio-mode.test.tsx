import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { BehaviourTreeDebugger } from '../BehaviourTreeDebugger';
import type { StudioProps, StudioClient, StudioTreeInfo, StudioCommandResult } from '../types';

global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

const mockClients: StudioClient[] = [
    { clientId: 'client-1', isOnline: true },
    { clientId: 'client-2', isOnline: false },
];

const mockTrees: StudioTreeInfo[] = [
    { treeId: 'tree-1' },
];

const mockTree = {
    type: 'fallback',
    id: 1,
    name: 'RootFallback',
    flags: 2,
};

const createMockStudioProps = (): StudioProps => ({
    clients: mockClients,
    selectedClientId: 'client-1',
    selectedTreeId: 'tree-1',
    trees: mockTrees,
    onSelectClient: vi.fn(),
    onSelectTree: vi.fn(),
    onSendCommand: vi.fn(async () => ({ success: true })),
    streamingEnabled: true,
    stateTraceEnabled: false,
    profilingEnabled: false,
    isClientOnline: true,
    isLive: true,
    onOpenSettings: vi.fn(),
});

describe('BehaviourTreeDebugger - Studio Mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders "No tree selected" when tree prop is undefined', () => {
        render(<BehaviourTreeDebugger isolateStyles={false} />);
        expect(screen.getByText('No tree selected')).toBeDefined();
        expect(screen.getByText('Select a client and a behavior tree to start debugging.')).toBeDefined();
    });

    it('studio controls are hidden when studio prop is absent', () => {
        render(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                isolateStyles={false}
            />
        );
        expect(screen.queryByText('Select Client')).toBeNull();
        expect(screen.queryByText('Select Tree')).toBeNull();
        expect(screen.queryByText('▶ Stream')).toBeNull();
        expect(screen.queryByText('⏸ Stream')).toBeNull();
    });

    it('studio controls are visible when studio prop is provided', () => {
        const studioProps = createMockStudioProps();
        render(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                studio={studioProps}
                isolateStyles={false}
            />
        );
        expect(screen.getByRole('combobox', { name: "Select client" })).toBeDefined();
        expect(screen.getByRole('combobox', { name: "Select tree" })).toBeDefined();
        expect(screen.getByTitle('Pause Streaming')).toBeDefined();
        expect(screen.getByTitle('Enable State Trace')).toBeDefined();
        expect(screen.getByTitle('Enable Profiling')).toBeDefined();
    });

    it('toggle buttons call onSendCommand with correct commands', async () => {
        const studioProps = createMockStudioProps();
        render(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                studio={studioProps}
                isolateStyles={false}
            />
        );

        const streamBtn = screen.getByTitle('Pause Streaming');
        fireEvent.click(streamBtn);
        expect(studioProps.onSendCommand).toHaveBeenCalledWith('disable-streaming', 'tree-1');

        const traceBtn = screen.getByTitle('Enable State Trace');
        fireEvent.click(traceBtn);
        expect(studioProps.onSendCommand).toHaveBeenCalledWith('enable-state-trace', 'tree-1');

        const profileBtn = screen.getByTitle('Enable Profiling');
        fireEvent.click(profileBtn);
        expect(studioProps.onSendCommand).toHaveBeenCalledWith('enable-profiling', 'tree-1');
    });

    it('online/offline indicator reflects isClientOnline', () => {
        const studioProps = createMockStudioProps();

        const { rerender } = render(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                studio={studioProps}
                isolateStyles={false}
            />
        );
        expect(screen.getByText('Online')).toBeDefined();

        rerender(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                studio={{ ...studioProps, isClientOnline: false }}
                isolateStyles={false}
            />
        );
        expect(screen.getByText('Offline')).toBeDefined();
    });

    it('client/tree selector calls onSelectClient/onSelectTree', () => {
        const studioProps = createMockStudioProps();
        render(
            <BehaviourTreeDebugger
                tree={mockTree as any}
                ticks={[]}
                studio={studioProps}
                isolateStyles={false}
            />
        );

        const clientSelect = screen.getByRole('combobox', { name: "Select client" });
        fireEvent.change(clientSelect, { target: { value: 'client-2' } });
        expect(studioProps.onSelectClient).toHaveBeenCalledWith('client-2');

        const treeSelect = screen.getByRole('combobox', { name: "Select tree" });
        fireEvent.change(treeSelect, { target: { value: 'tree-1' } });
        expect(studioProps.onSelectTree).toHaveBeenCalledWith('tree-1');
    });
});
