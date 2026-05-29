import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InstalledSkill } from '@/core/schemas/index.js';

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

const loadDirectoryContents = (baseDir: string): string[] => {
  const contents: string[] = [];

  const walk = (relativeDir = ''): void => {
    const absDir = relativeDir.length > 0 ? join(baseDir, relativeDir) : baseDir;
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const nextRelativePath = relativeDir.length > 0 ? join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(nextRelativePath);
        continue;
      }
      contents.push(`${nextRelativePath}:${readFileSync(join(baseDir, nextRelativePath), 'utf-8')}`);
    }
  };

  walk();
  return contents;
};

// compiler data 전체(context-layer, skills, packs, subagents) 해시
export const computeSourceHash = (dataDir: string): string => {
  return computeHash(loadDirectoryContents(resolve(dataDir)));
};

export const computeInstalledSkillHash = (params: {
  kind: InstalledSkill['kind'];
  description: string;
  tools: readonly string[];
  files: readonly string[];
}): string => computeHash([params.kind, params.description, ...[...params.tools].sort(), ...[...params.files].sort()]);

export const computeInstalledSubagentHash = (params: {
  id: string;
  tools: readonly string[];
  prompt: string;
  metadataFiles: readonly string[];
}): string => computeHash([params.id, params.prompt, ...[...params.tools].sort(), ...[...params.metadataFiles].sort()]);
