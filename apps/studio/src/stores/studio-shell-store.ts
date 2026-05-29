import { create } from 'zustand';

export const STUDIO_RUNTIME_VIEWS = ['integrations', 'skills', 'subagents', 'hooks'] as const;

export type StudioRuntimeView = (typeof STUDIO_RUNTIME_VIEWS)[number];

export const STUDIO_PROJECT_VIEWS = [
  'overview',
  'context-graph',
  'documents',
  'audit',
  ...STUDIO_RUNTIME_VIEWS,
  'appearance',
] as const;

export type StudioProjectView = (typeof STUDIO_PROJECT_VIEWS)[number];

type StudioShellState = {
  readonly selectedView: StudioProjectView;
  readonly selectedDocumentPath: string | null;
  readonly selectedAuditIssueId: string | null;
  readonly selectedRuntimeItemId: string | null;
  readonly sidebarCollapsed: boolean;
  readonly setSelectedView: (selectedView: StudioProjectView) => void;
  readonly setSelectedDocumentPath: (selectedDocumentPath: string | null) => void;
  readonly setSelectedAuditIssueId: (selectedAuditIssueId: string | null) => void;
  readonly setSelectedRuntimeItemId: (selectedRuntimeItemId: string | null) => void;
  readonly toggleSidebar: () => void;
};

export const useStudioShellStore = create<StudioShellState>((set) => ({
  selectedView: 'overview',
  selectedDocumentPath: null,
  selectedAuditIssueId: null,
  selectedRuntimeItemId: null,
  sidebarCollapsed: false,
  setSelectedView: (selectedView) => set({ selectedView }),
  setSelectedDocumentPath: (selectedDocumentPath) => set({ selectedDocumentPath }),
  setSelectedAuditIssueId: (selectedAuditIssueId) => set({ selectedAuditIssueId }),
  setSelectedRuntimeItemId: (selectedRuntimeItemId) => set({ selectedRuntimeItemId }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
