import { create } from 'zustand';

export const STUDIO_PROJECT_VIEWS = [
  'overview',
  'context-graph',
  'documents',
  'audit',
  'integrations',
  'skills',
  'subagents',
  'hooks',
  'appearance',
] as const;

export type StudioProjectView = (typeof STUDIO_PROJECT_VIEWS)[number];

type StudioShellState = {
  readonly selectedView: StudioProjectView;
  readonly selectedDocumentPath: string | null;
  readonly sidebarCollapsed: boolean;
  readonly setSelectedView: (selectedView: StudioProjectView) => void;
  readonly setSelectedDocumentPath: (selectedDocumentPath: string | null) => void;
  readonly toggleSidebar: () => void;
};

export const useStudioShellStore = create<StudioShellState>((set) => ({
  selectedView: 'overview',
  selectedDocumentPath: null,
  sidebarCollapsed: false,
  setSelectedView: (selectedView) => set({ selectedView }),
  setSelectedDocumentPath: (selectedDocumentPath) => set({ selectedDocumentPath }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
