import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isStudioThemePresetId, type StudioThemePresetId } from '@/theme/theme-preset-registry';

export const STUDIO_APPEARANCE_STORAGE_KEY = 'ai-ops-studio.appearance.v1';

export const STUDIO_COLOR_MODES = ['system', 'light', 'dark'] as const;
export const STUDIO_DENSITIES = ['comfortable', 'compact'] as const;
export const STUDIO_MARKDOWN_SIZES = ['small', 'medium', 'large'] as const;
export const STUDIO_CODE_BLOCK_STYLES = ['filled', 'outline'] as const;

export type StudioColorMode = (typeof STUDIO_COLOR_MODES)[number];
export type StudioDensity = (typeof STUDIO_DENSITIES)[number];
export type StudioMarkdownSize = (typeof STUDIO_MARKDOWN_SIZES)[number];
export type StudioCodeBlockStyle = (typeof STUDIO_CODE_BLOCK_STYLES)[number];

export type StudioAppearancePreference = {
  readonly presetId: StudioThemePresetId;
  readonly colorMode: StudioColorMode;
  readonly density: StudioDensity;
  readonly markdownSize: StudioMarkdownSize;
  readonly codeBlockStyle: StudioCodeBlockStyle;
};

type StudioAppearanceState = StudioAppearancePreference & {
  readonly setPresetId: (presetId: StudioThemePresetId) => void;
  readonly setColorMode: (colorMode: StudioColorMode) => void;
  readonly setDensity: (density: StudioDensity) => void;
  readonly setMarkdownSize: (markdownSize: StudioMarkdownSize) => void;
  readonly setCodeBlockStyle: (codeBlockStyle: StudioCodeBlockStyle) => void;
  readonly resetAppearance: () => void;
};

export const DEFAULT_STUDIO_APPEARANCE = {
  presetId: 'cohere',
  colorMode: 'system',
  density: 'comfortable',
  markdownSize: 'medium',
  codeBlockStyle: 'filled',
} as const satisfies StudioAppearancePreference;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && options.includes(value as T);

export const coerceStudioThemePresetId = (value: unknown): StudioThemePresetId =>
  isStudioThemePresetId(value) ? value : DEFAULT_STUDIO_APPEARANCE.presetId;

export const coerceStudioAppearancePreference = (value: unknown): StudioAppearancePreference => {
  if (!isRecord(value)) {
    return DEFAULT_STUDIO_APPEARANCE;
  }

  return {
    presetId: coerceStudioThemePresetId(value.presetId),
    colorMode: isOneOf(value.colorMode, STUDIO_COLOR_MODES) ? value.colorMode : DEFAULT_STUDIO_APPEARANCE.colorMode,
    density: isOneOf(value.density, STUDIO_DENSITIES) ? value.density : DEFAULT_STUDIO_APPEARANCE.density,
    markdownSize: isOneOf(value.markdownSize, STUDIO_MARKDOWN_SIZES)
      ? value.markdownSize
      : DEFAULT_STUDIO_APPEARANCE.markdownSize,
    codeBlockStyle: isOneOf(value.codeBlockStyle, STUDIO_CODE_BLOCK_STYLES)
      ? value.codeBlockStyle
      : DEFAULT_STUDIO_APPEARANCE.codeBlockStyle,
  };
};

const selectPersistedAppearance = (state: StudioAppearanceState): StudioAppearancePreference => ({
  presetId: state.presetId,
  colorMode: state.colorMode,
  density: state.density,
  markdownSize: state.markdownSize,
  codeBlockStyle: state.codeBlockStyle,
});

export const useStudioAppearanceStore = create<StudioAppearanceState>()(
  persist(
    (set) => ({
      ...DEFAULT_STUDIO_APPEARANCE,
      setPresetId: (presetId) => set({ presetId: coerceStudioThemePresetId(presetId) }),
      setColorMode: (colorMode) => set({ colorMode }),
      setDensity: (density) => set({ density }),
      setMarkdownSize: (markdownSize) => set({ markdownSize }),
      setCodeBlockStyle: (codeBlockStyle) => set({ codeBlockStyle }),
      resetAppearance: () => set(DEFAULT_STUDIO_APPEARANCE),
    }),
    {
      name: STUDIO_APPEARANCE_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: selectPersistedAppearance,
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...coerceStudioAppearancePreference(persistedState),
      }),
    },
  ),
);
