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
    selectTree: vi.fn(),
    setCapture: vi.fn(),
  };
}

describe('StudioDebugger', () => {
  beforeEach(() => {
    mockedUseStudioConnection.mockReturnValue(buildConnectionModel());
  });

  it('defaults to dark theme, shares theme toggle with controls, and renders no-tree state', () => {
    const { container } = render(
      <StudioDebugger
        debuggerProps={{
          showToolbar: false,
          isolateStyles: false,
        }}
      />,
    );

    const studioShell = container.querySelector('.bt-studio-shell');
    expect(studioShell?.className).toContain('bt-debugger--dark');
    expect(screen.getByText('No tree loaded')).toBeTruthy();
    expect(screen.getByText(/No ticks/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(studioShell?.className).toContain('bt-debugger--light');
  });
});
