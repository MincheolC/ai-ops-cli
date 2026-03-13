import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManifestSchema } from './schemas/index.js';
import type { Manifest, InstalledSkill } from './schemas/index.js';

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

const loadSortedFileContents = (dirPath: string): string[] => {
  const files = readdirSync(dirPath)
    .filter((f) => f.endsWith('.yaml'))
    .sort();

  return files.map((f) => readFileSync(resolve(dirPath, f), 'utf-8'));
};

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

const loadSkillTreeContents = (skillsDir: string): string[] => {
  const contents: string[] = [];
  const registryPath = resolve(skillsDir, 'skill-registry.json');

  if (existsSync(registryPath)) {
    contents.push(`skill-registry.json:${readFileSync(registryPath, 'utf-8')}`);
  }

  for (const directoryName of ['reference-skills', 'task-skills']) {
    const directoryPath = resolve(skillsDir, directoryName);
    if (!existsSync(directoryPath)) {
      continue;
    }

    const directoryContents = loadDirectoryContents(directoryPath).map((content) => `${directoryName}/${content}`);
    contents.push(...directoryContents);
  }

  return contents;
};

// compiler data 전체(rules, skills, presets) 해시
export const computeSourceHash = (dataDir: string): string => {
  const ruleContents = loadSortedFileContents(resolve(dataDir, 'rules'));
  const skillContents = loadSkillTreeContents(resolve(dataDir, 'skills'));
  const presetsContent = readFileSync(resolve(dataDir, 'presets.yaml'), 'utf-8');
  return computeHash([...ruleContents, ...skillContents, presetsContent]);
};

export const computeInstalledSkillHash = (params: {
  kind: InstalledSkill['kind'];
  description: string;
  tools: readonly string[];
  files: readonly string[];
}): string => computeHash([params.kind, params.description, ...[...params.tools].sort(), ...[...params.files].sort()]);

// Manifest Builder (Pure, 단 generatedAt에 현재 시각 사용)
export const buildManifest = (params: {
  tools: readonly string[];
  scope: 'project';
  preset?: string;
  workspaces?: Record<string, { preset: string; rules: string[] }>;
  installedRules: readonly string[];
  installedFiles?: readonly string[];
  installedSkills?: readonly InstalledSkill[];
  appendedFiles?: readonly string[];
  settings?: { claude?: readonly string[]; gemini?: readonly string[]; prettierignore?: boolean };
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
    installed_skills: params.installedSkills ? [...params.installedSkills] : undefined,
    appended_files: params.appendedFiles && params.appendedFiles.length > 0 ? [...params.appendedFiles] : undefined,
    settings: params.settings
      ? {
          claude: params.settings.claude ? [...params.settings.claude] : undefined,
          gemini: params.settings.gemini ? [...params.settings.gemini] : undefined,
          prettierignore: params.settings.prettierignore,
        }
      : undefined,
    cliVersion: params.cliVersion,
    sourceHash: params.sourceHash,
    generatedAt: new Date().toISOString(),
  });
