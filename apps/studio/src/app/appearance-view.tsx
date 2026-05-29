import { Check, Code2, LayoutGrid, Monitor, Moon, Rows3, Sun, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useStudioAppearanceStore,
  type StudioCodeBlockStyle,
  type StudioColorMode,
  type StudioDensity,
  type StudioMarkdownSize,
} from '@/stores/studio-appearance-store';
import { getStudioThemePreset, studioThemePresets } from '@/theme/theme-preset-registry';
import type { StudioThemeAppearance } from '@/theme/theme-preset.types';

type SegmentOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly icon?: LucideIcon;
};

type SegmentedControlProps<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly options: readonly SegmentOption<T>[];
  readonly onChange: (value: T) => void;
};

const colorModeOptions = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const satisfies readonly SegmentOption<StudioColorMode>[];

const densityOptions = [
  { value: 'comfortable', label: 'Comfortable', icon: LayoutGrid },
  { value: 'compact', label: 'Compact', icon: Rows3 },
] as const satisfies readonly SegmentOption<StudioDensity>[];

const markdownSizeOptions = [
  { value: 'small', label: 'Small', icon: Type },
  { value: 'medium', label: 'Medium', icon: Type },
  { value: 'large', label: 'Large', icon: Type },
] as const satisfies readonly SegmentOption<StudioMarkdownSize>[];

const codeBlockStyleOptions = [
  { value: 'filled', label: 'Filled', icon: Code2 },
  { value: 'outline', label: 'Outline', icon: Code2 },
] as const satisfies readonly SegmentOption<StudioCodeBlockStyle>[];

const getAppearanceBadgeVariant = (appearance: StudioThemeAppearance): 'default' | 'secondary' | 'outline' => {
  if (appearance === 'dark') {
    return 'secondary';
  }
  if (appearance === 'mixed') {
    return 'outline';
  }
  return 'default';
};

const formatAppearance = (appearance: StudioThemeAppearance): string =>
  appearance === 'mixed' ? 'native mixed' : `native ${appearance}`;

function ThemeSwatchStrip({ swatches }: { readonly swatches: readonly string[] }): React.JSX.Element {
  return (
    <div className="flex h-7 overflow-hidden rounded-md border">
      {swatches.map((swatch, index) => (
        <span
          key={`${swatch}-${index}`}
          className="min-w-7 flex-1"
          style={{ backgroundColor: swatch }}
          aria-label={swatch}
        />
      ))}
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="inline-flex max-w-full flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={cn(
                'inline-flex min-h-8 items-center gap-2 rounded-sm px-3 text-sm font-medium transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              onClick={() => {
                onChange(option.value);
              }}
            >
              {Icon !== undefined && <Icon className="size-4" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppearanceView(): React.JSX.Element {
  const presetId = useStudioAppearanceStore((state) => state.presetId);
  const colorMode = useStudioAppearanceStore((state) => state.colorMode);
  const density = useStudioAppearanceStore((state) => state.density);
  const markdownSize = useStudioAppearanceStore((state) => state.markdownSize);
  const codeBlockStyle = useStudioAppearanceStore((state) => state.codeBlockStyle);
  const setPresetId = useStudioAppearanceStore((state) => state.setPresetId);
  const setColorMode = useStudioAppearanceStore((state) => state.setColorMode);
  const setDensity = useStudioAppearanceStore((state) => state.setDensity);
  const setMarkdownSize = useStudioAppearanceStore((state) => state.setMarkdownSize);
  const setCodeBlockStyle = useStudioAppearanceStore((state) => state.setCodeBlockStyle);
  const resetAppearance = useStudioAppearanceStore((state) => state.resetAppearance);
  const selectedPreset = getStudioThemePreset(presetId);

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LayoutGrid className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Theme preset</h2>
            </div>
            <Badge variant="outline">{studioThemePresets.length} presets</Badge>
          </div>
          <div className="studio-density-list grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {studioThemePresets.map((preset) => {
              const selected = preset.id === presetId;

              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    'rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                    selected && 'border-primary bg-secondary',
                  )}
                  onClick={() => {
                    setPresetId(preset.id);
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{preset.label}</span>
                      <span className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                        {preset.sourceSlug}
                      </span>
                    </div>
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                  </div>
                  <ThemeSwatchStrip swatches={preset.preview.swatches} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={getAppearanceBadgeVariant(preset.preview.appearance)}>
                      {formatAppearance(preset.preview.appearance)}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Selected</h2>
            <Badge variant={getAppearanceBadgeVariant(selectedPreset.preview.appearance)}>
              {formatAppearance(selectedPreset.preview.appearance)}
            </Badge>
          </div>
          <ThemeSwatchStrip swatches={selectedPreset.preview.swatches} />
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Preset</dt>
              <dd className="mt-1 text-sm font-semibold">{selectedPreset.label}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Mode</dt>
              <dd className="mt-1 text-sm font-semibold">{colorMode}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Density</dt>
              <dd className="mt-1 text-sm font-semibold">{density}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Markdown</dt>
              <dd className="mt-1 text-sm font-semibold">{markdownSize}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Code blocks</dt>
              <dd className="mt-1 text-sm font-semibold">{codeBlockStyle}</dd>
            </div>
          </dl>
          <Button type="button" variant="outline" className="mt-5 w-full" onClick={resetAppearance}>
            Reset
          </Button>
        </aside>
      </section>

      <section className="studio-density-card rounded-lg border bg-card p-5 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <SegmentedControl
            label="Color mode"
            value={colorMode}
            options={colorModeOptions}
            onChange={(value) => {
              setColorMode(value);
            }}
          />
          <SegmentedControl
            label="Density"
            value={density}
            options={densityOptions}
            onChange={(value) => {
              setDensity(value);
            }}
          />
          <SegmentedControl
            label="Markdown size"
            value={markdownSize}
            options={markdownSizeOptions}
            onChange={(value) => {
              setMarkdownSize(value);
            }}
          />
          <SegmentedControl
            label="Code block style"
            value={codeBlockStyle}
            options={codeBlockStyleOptions}
            onChange={(value) => {
              setCodeBlockStyle(value);
            }}
          />
        </div>
      </section>
    </div>
  );
}
