import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ManifestSchema } from './schemas/index.js';
import type { Manifest } from './schemas/index.js';

export const MANIFEST_FILENAME = '.ai-ops-manifest.json';

// Pure
export const parseManifest = (json: string): Manifest => ManifestSchema.parse(JSON.parse(json));

export const serializeManifest = (manifest: Manifest): string => JSON.stringify(manifest, null, 2) + '\n';

// I/O
export const resolveManifestPath = (basePath: string): string => join(basePath, MANIFEST_FILENAME);

export const readManifest = (manifestPath: string): Manifest | null => {
  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    return null;
  }
  return parseManifest(raw);
};

export const writeManifest = (manifestPath: string, manifest: Manifest): void => {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeManifest(manifest), 'utf-8');
};
