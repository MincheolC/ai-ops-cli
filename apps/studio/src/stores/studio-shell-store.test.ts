import { beforeEach, describe, expect, it } from 'vitest';
import { useStudioShellStore } from './studio-shell-store';

describe('studio shell store', () => {
  beforeEach(() => {
    useStudioShellStore.setState({
      selectedView: 'overview',
      selectedDocumentPath: null,
      sidebarCollapsed: false,
    });
  });

  it('tracks selected view and document only as local shell state', () => {
    useStudioShellStore.getState().setSelectedView('context-graph');
    useStudioShellStore.getState().setSelectedDocumentPath('docs/agent/workflow.md');

    const state = useStudioShellStore.getState();
    expect(state.selectedView).toBe('context-graph');
    expect(state.selectedDocumentPath).toBe('docs/agent/workflow.md');
    expect(state).not.toHaveProperty('snapshot');
    expect(state).not.toHaveProperty('project');
    expect(state).not.toHaveProperty('runtime');
  });

  it('tracks layout state without snapshot payloads', () => {
    useStudioShellStore.getState().toggleSidebar();

    const state = useStudioShellStore.getState();
    expect(state.sidebarCollapsed).toBe(true);
    expect(Object.keys(state).sort()).toEqual([
      'selectedDocumentPath',
      'selectedView',
      'setSelectedDocumentPath',
      'setSelectedView',
      'sidebarCollapsed',
      'toggleSidebar',
    ]);
  });
});
