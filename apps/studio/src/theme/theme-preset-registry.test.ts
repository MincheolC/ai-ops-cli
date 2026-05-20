import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { requiredStudioThemeTokenKeys, studioThemePresets } from './theme-preset-registry.js';
import type { StudioThemePresetId } from './theme-preset-registry.js';
import type { StudioThemePreset } from './theme-preset.types.js';

type SourceManifest = {
  sourceSlug: string;
  id: string;
  label: string;
  command: string;
  generatedFiles: readonly {
    path: string;
    included: boolean;
    checksum: string;
  }[];
  importedFiles: readonly string[];
  excludedFiles: readonly string[];
};

const expectedPresets = [
  ['cohere', 'cohere'],
  ['x-ai', 'x.ai'],
  ['vercel', 'vercel'],
  ['clickhouse', 'clickhouse'],
  ['hashicorp', 'hashicorp'],
  ['sentry', 'sentry'],
  ['cal', 'cal'],
  ['linear-app', 'linear.app'],
  ['framer', 'framer'],
  ['stripe', 'stripe'],
  ['spotify', 'spotify'],
] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const studioRoot = join(__dirname, '../../');

const resolveStudioPath = (relativePath: string): string => join(studioRoot, relativePath);

const computeSha256Checksum = (relativePath: string): string =>
  `sha256:${createHash('sha256')
    .update(readFileSync(resolveStudioPath(relativePath)))
    .digest('hex')}`;

const acceptPresetId = (presetId: StudioThemePresetId): StudioThemePresetId => presetId;

const _assertPresetIdType = (): void => {
  acceptPresetId('x-ai');
  // @ts-expect-error invalid preset ids must not be accepted at compile time.
  acceptPresetId('unknown');
};

const isSourceManifest = (value: unknown): value is SourceManifest => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.sourceSlug === 'string' &&
    typeof record.id === 'string' &&
    typeof record.label === 'string' &&
    typeof record.command === 'string' &&
    Array.isArray(record.generatedFiles) &&
    Array.isArray(record.importedFiles) &&
    Array.isArray(record.excludedFiles)
  );
};

const readSourceManifest = (preset: StudioThemePreset): SourceManifest => {
  const parsed: unknown = JSON.parse(readFileSync(resolveStudioPath(preset.sourceManifestPath), 'utf-8'));
  if (!isSourceManifest(parsed)) {
    throw new Error(`Invalid source manifest: ${preset.id}`);
  }
  return parsed;
};

describe('studio theme preset registry', () => {
  it('contains all bundled getdesign presets in order', () => {
    expect(studioThemePresets.map((preset) => [preset.id, preset.sourceSlug])).toEqual(expectedPresets);
  });

  it('does not contain duplicate preset ids', () => {
    const ids = studioThemePresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('normalizes dotted source slugs into stable preset ids', () => {
    expect(studioThemePresets.find((preset) => preset.sourceSlug === 'x.ai')?.id).toBe('x-ai');
    expect(studioThemePresets.find((preset) => preset.sourceSlug === 'linear.app')?.id).toBe('linear-app');
  });

  it('exposes preset ids as a literal union instead of string', () => {
    expect(acceptPresetId('x-ai')).toBe('x-ai');
  });

  it('keeps generated design docs and source manifests on disk', () => {
    for (const preset of studioThemePresets) {
      expect(existsSync(resolveStudioPath(preset.designMdPath))).toBe(true);
      expect(existsSync(resolveStudioPath(preset.sourceManifestPath))).toBe(true);

      const manifest = readSourceManifest(preset);
      expect(manifest.id).toBe(preset.id);
      expect(manifest.sourceSlug).toBe(preset.sourceSlug);
      expect(manifest.command).toBe(`npx getdesign@latest add ${preset.sourceSlug}`);
      expect(manifest.importedFiles).toEqual(['DESIGN.md']);

      const designFile = manifest.generatedFiles.find((file) => file.path === 'DESIGN.md' && file.included);
      if (designFile === undefined) {
        throw new Error(`Missing included DESIGN.md entry: ${preset.id}`);
      }

      for (const file of manifest.generatedFiles) {
        expect(file.checksum, `${preset.id}.${file.path}`).toMatch(/^sha256:[0-9a-f]{64}$/);

        if (file.included) {
          expect(file.checksum, `${preset.id}.${file.path}`).toBe(
            computeSha256Checksum(join(dirname(preset.sourceManifestPath), file.path)),
          );
        }
      }
    }
  });

  it('provides every required shadcn-compatible token key', () => {
    for (const preset of studioThemePresets) {
      for (const key of requiredStudioThemeTokenKeys) {
        expect(preset.tokenMap[key], `${preset.id}.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('provides preview metadata for theme selection UI', () => {
    for (const preset of studioThemePresets) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.preview.summary.length).toBeGreaterThan(0);
      expect(preset.preview.swatches.length).toBeGreaterThanOrEqual(4);
      expect(preset.preview.typography.displayFont.length).toBeGreaterThan(0);
      expect(preset.preview.typography.bodyFont.length).toBeGreaterThan(0);
    }
  });
});
