import { beforeEach, describe, expect, it } from 'vitest';
import { useStudioShellStore } from './studio-shell-store';

describe('studio shell store', () => {
  beforeEach(() => {
    useStudioShellStore.setState({
      selectedView: 'overview',
      selectedDocumentPath: null,
      selectedAuditIssueId: null,
      selectedRuntimeItemId: null,
      sidebarCollapsed: false,
    });
  });

  it('tracks selected view, document, audit issue, and runtime item only as local shell state', () => {
    useStudioShellStore.getState().setSelectedView('context-graph');
    useStudioShellStore.getState().setSelectedDocumentPath('docs/agent/workflow.md');
    useStudioShellStore.getState().setSelectedAuditIssueId('0:error:missing-file:file-system:AGENTS.md');
    useStudioShellStore.getState().setSelectedRuntimeItemId('pc');

    const state = useStudioShellStore.getState();
    expect(state.selectedView).toBe('context-graph');
    expect(state.selectedDocumentPath).toBe('docs/agent/workflow.md');
    expect(state.selectedAuditIssueId).toBe('0:error:missing-file:file-system:AGENTS.md');
    expect(state.selectedRuntimeItemId).toBe('pc');
    expect(state).not.toHaveProperty('snapshot');
    expect(state).not.toHaveProperty('project');
    expect(state).not.toHaveProperty('runtime');
  });

  it('tracks layout state without snapshot payloads', () => {
    useStudioShellStore.getState().toggleSidebar();

    const state = useStudioShellStore.getState();
    expect(state.sidebarCollapsed).toBe(true);
    expect(Object.keys(state).sort()).toEqual([
      'selectedAuditIssueId',
      'selectedDocumentPath',
      'selectedRuntimeItemId',
      'selectedView',
      'setSelectedAuditIssueId',
      'setSelectedDocumentPath',
      'setSelectedRuntimeItemId',
      'setSelectedView',
      'sidebarCollapsed',
      'toggleSidebar',
    ]);
  });
});
