import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { StudioConnectionModel } from './types';
import { StudioDebugger } from '../StudioDebugger';
import { useStudioConnection } from './useStudioConnection';

vi.mock('./useStudioConnection', () => ({
  useStudioConnection: vi.fn(),
}));

const mockedUseStudioConnection = vi.mocked(useStudioConnection);

function buildConnectionModel(): StudioConnectionModel {
  return {
    status: 'connected',
    mode: 'listen',
    agents: [],
    trees: [],
    selectedAgentId: null,
    selectedTreeKey: null,
    tree: null,
    ticks: [],
    setMode: vi.fn(),
    connectTarget: vi.fn(),
    selectAgent: vi.fn(),
    detachAgent: vi.fn(),
    retryNow: vi.fn(),
    selectTree: vi.fn(),
    setCapture: vi.fn(),
  };
}

describe('StudioDebugger', () => {
  beforeEach(() => {
    mockedUseStudioConnection.mockReturnValue(buildConnectionModel());
  });

  it('renders integrated studio title, dark theme by default, and no-tree state', () => {
    const { container } = render(
      <StudioDebugger
        debuggerProps={{
          showToolbar: false,
          isolateStyles: false,
        }}
      />,
    );

    const debuggerRoot = container.querySelector('.bt-debugger');
    expect(debuggerRoot?.className).toContain('bt-debugger--dark');
    expect(screen.getByText('Behavior Tree Studio')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show connection panel' })).toBeTruthy();
    expect(screen.getByText('No tree loaded')).toBeTruthy();
    expect(screen.getByText(/No ticks/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(debuggerRoot?.className).toContain('bt-debugger--light');
  });
});
