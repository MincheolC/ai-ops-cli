import { create } from 'zustand';

export const STUDIO_NAV_ITEMS = [
  'project',
  'runtime',
  'settings',
  'documents',
  'audit',
  'integrations',
  'workflows',
] as const;

export type StudioNavItem = (typeof STUDIO_NAV_ITEMS)[number];

type StudioShellState = {
  readonly selectedNav: StudioNavItem;
  readonly sidebarCollapsed: boolean;
  readonly setSelectedNav: (selectedNav: StudioNavItem) => void;
  readonly toggleSidebar: () => void;
};

export const useStudioShellStore = create<StudioShellState>((set) => ({
  selectedNav: 'project',
  sidebarCollapsed: false,
  setSelectedNav: (selectedNav) => set({ selectedNav }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
