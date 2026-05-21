import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SubagentManifestSchema } from '@/core/schemas/index.js';
import type { SubagentManifest } from '@/core/schemas/index.js';

export const SUBAGENT_MANIFEST_FILENAME = 'subagents-manifest.json';

export const parseSubagentManifest = (json: string): SubagentManifest =>
  SubagentManifestSchema.parse(JSON.parse(json));

export const serializeSubagentManifest = (manifest: SubagentManifest): string => JSON.stringify(manifest, null, 2) + '\n';

export const resolveSubagentManifestPath = (userBasePath: string): string =>
  join(userBasePath, '.ai-ops', SUBAGENT_MANIFEST_FILENAME);

export const readSubagentManifest = (manifestPath: string): SubagentManifest | null => {
  let raw: string;
  try {
    raw = readFileSync(manifestPath, 'utf-8');
  } catch {
    return null;
  }

  return parseSubagentManifest(raw);
};

export const writeSubagentManifest = (manifestPath: string, manifest: SubagentManifest): void => {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeSubagentManifest(manifest), 'utf-8');
};
