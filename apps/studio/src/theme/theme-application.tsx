import { useEffect, useState, type ReactNode } from 'react';
import { useStudioAppearanceStore, type StudioAppearancePreference } from '@/stores/studio-appearance-store';
import { getStudioThemePreset } from './theme-preset-registry';
import type { StudioThemeTokenMap } from './theme-preset.types';

type EffectiveColorMode = 'light' | 'dark';

type AppliedThemeState = StudioAppearancePreference & {
  readonly effectiveColorMode: EffectiveColorMode;
};

type StudioAppearanceProviderProps = {
  readonly children: ReactNode;
};

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const TOKEN_CSS_VARIABLES = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  primary: '--primary',
  primaryForeground: '--primary-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  accent: '--accent',
  accentForeground: '--accent-foreground',
  destructive: '--destructive',
  destructiveForeground: '--destructive-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  chart1: '--chart-1',
  chart2: '--chart-2',
  chart3: '--chart-3',
  chart4: '--chart-4',
  chart5: '--chart-5',
} as const satisfies Record<keyof StudioThemeTokenMap, string>;

const getSystemColorMode = (): EffectiveColorMode => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light';
};

const resolveEffectiveColorMode = (preference: StudioAppearancePreference): EffectiveColorMode => {
  if (preference.colorMode === 'light' || preference.colorMode === 'dark') {
    return preference.colorMode;
  }

  return getSystemColorMode();
};

export const applyStudioThemeToRoot = (root: HTMLElement, theme: AppliedThemeState): void => {
  const preset = getStudioThemePreset(theme.presetId);

  for (const [tokenKey, cssVariable] of Object.entries(TOKEN_CSS_VARIABLES)) {
    const typedTokenKey = tokenKey as keyof StudioThemeTokenMap;
    root.style.setProperty(cssVariable, preset.tokenMap[typedTokenKey]);
  }

  root.dataset.themePreset = preset.id;
  root.dataset.colorMode = theme.colorMode;
  root.dataset.effectiveColorMode = theme.effectiveColorMode;
  root.dataset.density = theme.density;
  root.dataset.markdownSize = theme.markdownSize;
  root.dataset.codeBlockStyle = theme.codeBlockStyle;
};

export function StudioAppearanceProvider({ children }: StudioAppearanceProviderProps): React.JSX.Element {
  const presetId = useStudioAppearanceStore((state) => state.presetId);
  const colorMode = useStudioAppearanceStore((state) => state.colorMode);
  const density = useStudioAppearanceStore((state) => state.density);
  const markdownSize = useStudioAppearanceStore((state) => state.markdownSize);
  const codeBlockStyle = useStudioAppearanceStore((state) => state.codeBlockStyle);
  const [effectiveColorMode, setEffectiveColorMode] = useState<EffectiveColorMode>(() =>
    resolveEffectiveColorMode({ presetId, colorMode, density, markdownSize, codeBlockStyle }),
  );

  useEffect(() => {
    if (colorMode !== 'system') {
      setEffectiveColorMode(colorMode);
      return;
    }

    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setEffectiveColorMode('light');
      return;
    }

    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const updateEffectiveMode = (): void => {
      setEffectiveColorMode(media.matches ? 'dark' : 'light');
    };

    updateEffectiveMode();
    media.addEventListener('change', updateEffectiveMode);

    return () => {
      media.removeEventListener('change', updateEffectiveMode);
    };
  }, [colorMode]);

  useEffect(() => {
    applyStudioThemeToRoot(document.documentElement, {
      presetId,
      colorMode,
      density,
      markdownSize,
      codeBlockStyle,
      effectiveColorMode,
    });
  }, [codeBlockStyle, colorMode, density, effectiveColorMode, markdownSize, presetId]);

  return <>{children}</>;
}
