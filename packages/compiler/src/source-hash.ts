import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ManifestSchema } from './schemas/index.js';
import type { Manifest } from './schemas/index.js';

// 문자열 배열 → SHA-256 → 6-hex (caller가 정렬 책임)
export const computeHash = (contents: readonly string[]): string =>
  createHash('sha256').update(contents.join('')).digest('hex').slice(0, 6);

// rulesDir 내 YAML 파일들을 alphabetical 정렬 후 해싱
export const computeSourceHash = (rulesDir: string): string => {
  const files = readdirSync(rulesDir)
    .filter((f) => f.endsWith('.yaml'))
    .sort();
  const contents = files.map((f) => readFileSync(resolve(rulesDir, f), 'utf-8'));
  return computeHash(contents);
};

// Manifest Builder (Pure, 단 generatedAt에 현재 시각 사용)
export const buildManifest = (params: {
  tools: readonly string[];
  scope: 'project' | 'global';
  preset?: string;
  workspaces?: Record<string, { preset: string; rules: string[] }>;
  installedRules: readonly string[];
  installedFiles?: readonly string[];
  appendedFiles?: readonly string[];
  sourceHash: string;
}): Manifest =>
  ManifestSchema.parse({
    tools: [...params.tools],
    scope: params.scope,
    preset: params.preset,
    workspaces: params.workspaces,
    installed_rules: [...params.installedRules],
    installed_files: params.installedFiles ? [...params.installedFiles] : undefined,
    appended_files: params.appendedFiles && params.appendedFiles.length > 0 ? [...params.appendedFiles] : undefined,
    sourceHash: params.sourceHash,
    generatedAt: new Date().toISOString(),
  });
