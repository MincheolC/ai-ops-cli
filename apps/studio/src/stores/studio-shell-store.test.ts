import { beforeEach, describe, expect, it } from 'vitest';
import { useStudioShellStore } from './studio-shell-store';

describe('studio shell store', () => {
  beforeEach(() => {
    useStudioShellStore.setState({
      selectedNav: 'project',
      sidebarCollapsed: false,
    });
  });

  it('tracks selected nav only as local shell state', () => {
    useStudioShellStore.getState().setSelectedNav('runtime');

    const state = useStudioShellStore.getState();
    expect(state.selectedNav).toBe('runtime');
    expect(state).not.toHaveProperty('snapshot');
    expect(state).not.toHaveProperty('project');
    expect(state).not.toHaveProperty('runtime');
  });

  it('tracks layout state without snapshot payloads', () => {
    useStudioShellStore.getState().toggleSidebar();

    const state = useStudioShellStore.getState();
    expect(state.sidebarCollapsed).toBe(true);
    expect(Object.keys(state).sort()).toEqual(['selectedNav', 'setSelectedNav', 'sidebarCollapsed', 'toggleSidebar']);
  });
});
