import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestSchema } from './schemas/index.js';
import type { Manifest } from './schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// dist/bin/index.js(bundle) 기준: ../../package.json = apps/cli/package.json
export const getCliVersion = (): string => {
  try {
    const pkgPath = resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
};

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
  scope: 'project';
  preset?: string;
  workspaces?: Record<string, { preset: string; rules: string[] }>;
  installedRules: readonly string[];
  installedFiles?: readonly string[];
  appendedFiles?: readonly string[];
  settings?: { claude?: readonly string[]; gemini?: readonly string[] };
  cliVersion?: string;
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
    settings: params.settings
      ? {
          claude: params.settings.claude ? [...params.settings.claude] : undefined,
          gemini: params.settings.gemini ? [...params.settings.gemini] : undefined,
        }
      : undefined,
    cliVersion: params.cliVersion,
    sourceHash: params.sourceHash,
    generatedAt: new Date().toISOString(),
  });
