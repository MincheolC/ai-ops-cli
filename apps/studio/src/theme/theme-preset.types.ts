export type StudioThemeAppearance = 'light' | 'dark' | 'mixed';

export type StudioThemeTokenMap = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

export type StudioThemePreview = {
  appearance: StudioThemeAppearance;
  summary: string;
  swatches: readonly string[];
  typography: {
    displayFont: string;
    bodyFont: string;
    monoFont: string | null;
  };
};

export type StudioThemePreset = {
  id: string;
  sourceSlug: string;
  label: string;
  designMdPath: string;
  sourceManifestPath: string;
  tokenMap: StudioThemeTokenMap;
  preview: StudioThemePreview;
};
