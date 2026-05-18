import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseMarkdownFrontmatter } from './frontmatter.js';
import {
  PackCatalogSchema,
  ProjectLayerFrontmatterSchema,
  ProjectLayerManifestSchema,
  isSafeProjectLayerPath,
} from './schemas/index.js';
import type {
  PackCatalog,
  ProjectLayerContextIndex,
  ProjectLayerManifest,
  ProjectLayerPackFileRecord,
  ProjectLayerPackRecord,
} from './schemas/index.js';
import { computeHash, getCliVersion } from './source-hash.js';
import { COMPILER_DATA_DIR } from './paths.js';
import {
  readProjectLayerManifest,
  refreshProjectLayerDerivedState,
  resolveProjectLayerFilePath,
  writeProjectLayerManifest,
} from './project-layer.js';

// ----- types -----

export type ProjectLayerPackSourceFile = {
  path: string;
  content: string;
  sourceHash: string;
};

export type ProjectLayerPackSource = {
  id: string;
  sourceHash: string;
  documents: ProjectLayerPackSourceFile[];
  files: ProjectLayerPackSourceFile[];
};

export type ProjectLayerPackApplyResult = {
  manifest: ProjectLayerManifest;
  contextIndex: ProjectLayerContextIndex;
  written: string[];
  refreshed: string[];
  preserved: string[];
  deleted: string[];
  notFound: string[];
};

export type ProjectLayerPackIssueLevel = 'error' | 'warning';

export type ProjectLayerPackIssue = {
  level: ProjectLayerPackIssueLevel;
  code: string;
  message: string;
};

export type ProjectLayerPackReport = {
  issues: ProjectLayerPackIssue[];
};

type PackFileApplyResult = {
  written: string[];
  refreshed: string[];
  preserved: string[];
  deleted: string[];
  notFound: string[];
};

// ----- constants -----

const PACK_REGISTRY_FILENAME = 'pack-registry.json';
const SPEC_LIFECYCLE_PACK_ID = 'spec-lifecycle';
const PACK_INSTALL_ROOT = 'docs/specs/';
const RESERVED_DOCUMENT_WARNINGS = [
  '판단 근거로 사용하지 마세요',
  'Do not use this document as current decision-making evidence',
] as const;
const DEFAULT_PACKS_DIR = join(COMPILER_DATA_DIR, 'packs');

// ----- source loading -----

const includesReservedDocumentWarning = (content: string): boolean =>
  RESERVED_DOCUMENT_WARNINGS.some((warning) => content.includes(warning));

const readPackCatalog = (packsDir: string): PackCatalog =>
  PackCatalogSchema.parse(JSON.parse(readFileSync(join(packsDir, PACK_REGISTRY_FILENAME), 'utf-8')));

const assertPackInstallPath = (path: string): void => {
  if (!isSafeProjectLayerPath(path) || !path.startsWith(PACK_INSTALL_ROOT)) {
    throw new Error(`Unsafe pack path: ${path}`);
  }
};

const readPackSourceFiles = (packDir: string): ProjectLayerPackSourceFile[] => {
  const files: ProjectLayerPackSourceFile[] = [];

  const walk = (relativeDir = ''): void => {
    const absoluteDir = relativeDir.length > 0 ? join(packDir, relativeDir) : packDir;
    const entries = readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const nextRelativePath = relativeDir.length > 0 ? join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(nextRelativePath);
        continue;
      }

      assertPackInstallPath(nextRelativePath);
      const content = readFileSync(join(packDir, nextRelativePath), 'utf-8');
      files.push({
        path: nextRelativePath,
        content,
        sourceHash: computeHash([content.trimEnd()]),
      });
    }
  };

  walk();
  return files;
};

const splitPackSourceFiles = (files: readonly ProjectLayerPackSourceFile[]): {
  documents: ProjectLayerPackSourceFile[];
  files: ProjectLayerPackSourceFile[];
} => {
  const documents: ProjectLayerPackSourceFile[] = [];
  const regularFiles: ProjectLayerPackSourceFile[] = [];

  for (const file of files) {
    if (!file.path.endsWith('.md')) {
      regularFiles.push(file);
      continue;
    }

    const { frontmatter } = parseMarkdownFrontmatter(file.content);
    const parsed = ProjectLayerFrontmatterSchema.parse(frontmatter);
    if (parsed.status === 'Reserved' && !includesReservedDocumentWarning(file.content)) {
      throw new Error(`Reserved pack document must include warning text: ${file.path}`);
    }
    documents.push(file);
  }

  return { documents, files: regularFiles };
};

export const loadAllPacks = (packsDir: string): ProjectLayerPackSource[] => {
  const catalog = readPackCatalog(packsDir);
  const entries = [...catalog.packs].sort((a, b) => a.id.localeCompare(b.id));

  return entries.map((entry) => {
    if (entry.id !== SPEC_LIFECYCLE_PACK_ID) {
      throw new Error(`Unsupported pack id: ${entry.id}`);
    }

    const packDir = resolve(packsDir, entry.source_path);
    const relativeFromPacks = relative(resolve(packsDir), packDir);
    if (relativeFromPacks.length === 0 || relativeFromPacks.startsWith('..') || isAbsolute(relativeFromPacks)) {
      throw new Error(`Pack source path escapes packs dir: ${entry.source_path}`);
    }

    const files = readPackSourceFiles(packDir);
    const split = splitPackSourceFiles(files);

    return {
      id: entry.id,
      sourceHash: computeHash(files.map((file) => `${file.path}:${file.content}`).sort()),
      documents: split.documents,
      files: split.files,
    };
  });
};

const resolvePackById = (packsDir: string, packId: string): ProjectLayerPackSource => {
  const pack = loadAllPacks(packsDir).find((candidate) => candidate.id === packId);
  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }
  return pack;
};

// ----- file application -----

const serializePackFileContent = (content: string): string => (content.length === 0 ? '' : content.trimEnd() + '\n');

const readProjectFileHash = (basePath: string, relativePath: string): string =>
  computeHash([readFileSync(resolveProjectLayerFilePath(basePath, relativePath), 'utf-8').trimEnd()]);

const writePackFile = (basePath: string, file: ProjectLayerPackSourceFile): void => {
  const absolutePath = resolveProjectLayerFilePath(basePath, file.path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, serializePackFileContent(file.content), 'utf-8');
};

const buildPackFileRecords = (files: readonly ProjectLayerPackSourceFile[]): ProjectLayerPackFileRecord[] =>
  files.map((file) => ({
    path: file.path,
    sourceHash: file.sourceHash,
  }));

const buildPackRecord = (params: {
  pack: ProjectLayerPackSource;
  installedAt: string;
}): ProjectLayerPackRecord => ({
  id: params.pack.id,
  sourceHash: params.pack.sourceHash,
  documents: buildPackFileRecords(params.pack.documents),
  files: buildPackFileRecords(params.pack.files),
  installedAt: params.installedAt,
});

const applyPackSourceFiles = (params: {
  basePath: string;
  pack: ProjectLayerPackSource;
  previousRecord: ProjectLayerPackRecord | null;
}): PackFileApplyResult => {
  const written: string[] = [];
  const refreshed: string[] = [];
  const preserved: string[] = [];
  const deleted: string[] = [];
  const notFound: string[] = [];
  const sourceFiles = [...params.pack.documents, ...params.pack.files];
  const sourceByPath = new Map(sourceFiles.map((file) => [file.path, file]));
  const previousByPath = new Map(
    [...(params.previousRecord?.documents ?? []), ...(params.previousRecord?.files ?? [])].map((file) => [
      file.path,
      file,
    ]),
  );

  for (const file of sourceFiles) {
    const absolutePath = resolveProjectLayerFilePath(params.basePath, file.path);
    const previous = previousByPath.get(file.path);

    if (!existsSync(absolutePath)) {
      writePackFile(params.basePath, file);
      written.push(file.path);
      continue;
    }

    if (previous === undefined) {
      preserved.push(file.path);
      continue;
    }

    const currentHash = readProjectFileHash(params.basePath, file.path);
    if (currentHash !== previous.sourceHash) {
      preserved.push(file.path);
      continue;
    }

    if (currentHash !== file.sourceHash) {
      writePackFile(params.basePath, file);
      refreshed.push(file.path);
    }
  }

  for (const previous of previousByPath.values()) {
    if (sourceByPath.has(previous.path)) {
      continue;
    }

    const absolutePath = resolveProjectLayerFilePath(params.basePath, previous.path);
    if (!existsSync(absolutePath)) {
      notFound.push(previous.path);
      continue;
    }

    if (readProjectFileHash(params.basePath, previous.path) === previous.sourceHash) {
      rmSync(absolutePath);
      deleted.push(previous.path);
    } else {
      preserved.push(previous.path);
    }
  }

  return { written, refreshed, preserved, deleted, notFound };
};

const removePackFiles = (basePath: string, record: ProjectLayerPackRecord): PackFileApplyResult => {
  const deleted: string[] = [];
  const preserved: string[] = [];
  const notFound: string[] = [];

  for (const file of [...record.documents, ...record.files]) {
    const absolutePath = resolveProjectLayerFilePath(basePath, file.path);
    if (!existsSync(absolutePath)) {
      notFound.push(file.path);
      continue;
    }

    if (readProjectFileHash(basePath, file.path) === file.sourceHash) {
      rmSync(absolutePath);
      deleted.push(file.path);
    } else {
      preserved.push(file.path);
    }
  }

  return { written: [], refreshed: [], preserved, deleted, notFound };
};

const removeEmptyDirs = (basePath: string, relativePaths: readonly string[]): void => {
  const dirs = [...new Set(relativePaths.map((path) => dirname(path)).filter((dir) => dir !== '.'))].sort(
    (a, b) => b.length - a.length,
  );

  for (const dir of dirs) {
    const absoluteDir = resolveProjectLayerFilePath(basePath, dir);
    if (!existsSync(absoluteDir)) {
      continue;
    }

    try {
      if (readdirSync(absoluteDir).length === 0) {
        rmSync(absoluteDir, { recursive: true });
      }
    } catch {
      // Directory cleanup is best-effort only.
    }
  }
};

// ----- manifest updates -----

const requireProjectLayerManifest = (basePath: string): ProjectLayerManifest => {
  const manifest = readProjectLayerManifest(basePath);
  if (!manifest) {
    throw new Error('.ai-ops/manifest.json이 없습니다. 먼저 ai-ops init을 실행하세요.');
  }
  return manifest;
};

const upsertPackRecord = (
  manifest: ProjectLayerManifest,
  record: ProjectLayerPackRecord,
  generatedAt: string,
): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse({
    ...manifest,
    packs: [...manifest.packs.filter((pack) => pack.id !== record.id), record],
    cliVersion: getCliVersion(),
    generatedAt,
  });

const removePackRecord = (manifest: ProjectLayerManifest, packId: string, generatedAt: string): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse({
    ...manifest,
    packs: manifest.packs.filter((pack) => pack.id !== packId),
    cliVersion: getCliVersion(),
    generatedAt,
  });

const writeManifestWithDerivedState = (params: {
  basePath: string;
  manifest: ProjectLayerManifest;
  generatedAt: string;
}): {
  manifest: ProjectLayerManifest;
  contextIndex: ProjectLayerContextIndex;
} => {
  const derived = refreshProjectLayerDerivedState({
    basePath: params.basePath,
    manifest: params.manifest,
    generatedAt: params.generatedAt,
  });
  writeProjectLayerManifest(params.basePath, derived.manifest);
  return derived;
};

// ----- lifecycle -----

export const installProjectLayerPack = (params: {
  basePath: string;
  packId: string;
  packsDir?: string;
}): ProjectLayerPackApplyResult => {
  const manifest = requireProjectLayerManifest(params.basePath);
  const previousRecord = manifest.packs.find((pack) => pack.id === params.packId);
  if (previousRecord) {
    return updateProjectLayerPack(params);
  }

  const pack = resolvePackById(params.packsDir ?? DEFAULT_PACKS_DIR, params.packId);
  const installedAt = new Date().toISOString();
  const applyResult = applyPackSourceFiles({ basePath: params.basePath, pack, previousRecord: null });
  const nextManifest = upsertPackRecord(manifest, buildPackRecord({ pack, installedAt }), installedAt);
  const derived = writeManifestWithDerivedState({
    basePath: params.basePath,
    manifest: nextManifest,
    generatedAt: installedAt,
  });

  return { ...applyResult, manifest: derived.manifest, contextIndex: derived.contextIndex };
};

export const updateProjectLayerPack = (params: {
  basePath: string;
  packId: string;
  packsDir?: string;
}): ProjectLayerPackApplyResult => {
  const manifest = requireProjectLayerManifest(params.basePath);
  const previousRecord = manifest.packs.find((pack) => pack.id === params.packId);
  if (!previousRecord) {
    throw new Error(`설치된 pack을 찾지 못했습니다: ${params.packId}`);
  }

  const pack = resolvePackById(params.packsDir ?? DEFAULT_PACKS_DIR, params.packId);
  const generatedAt = new Date().toISOString();
  const applyResult = applyPackSourceFiles({ basePath: params.basePath, pack, previousRecord });
  const nextManifest = upsertPackRecord(
    manifest,
    buildPackRecord({ pack, installedAt: previousRecord.installedAt }),
    generatedAt,
  );
  const derived = writeManifestWithDerivedState({
    basePath: params.basePath,
    manifest: nextManifest,
    generatedAt,
  });

  removeEmptyDirs(params.basePath, applyResult.deleted);
  return { ...applyResult, manifest: derived.manifest, contextIndex: derived.contextIndex };
};

export const uninstallProjectLayerPack = (params: {
  basePath: string;
  packId: string;
}): ProjectLayerPackApplyResult => {
  const manifest = requireProjectLayerManifest(params.basePath);
  const previousRecord = manifest.packs.find((pack) => pack.id === params.packId);
  if (!previousRecord) {
    throw new Error(`설치된 pack을 찾지 못했습니다: ${params.packId}`);
  }

  const generatedAt = new Date().toISOString();
  const applyResult = removePackFiles(params.basePath, previousRecord);
  const nextManifest = removePackRecord(manifest, params.packId, generatedAt);
  const derived = writeManifestWithDerivedState({
    basePath: params.basePath,
    manifest: nextManifest,
    generatedAt,
  });

  removeEmptyDirs(params.basePath, applyResult.deleted);
  return { ...applyResult, manifest: derived.manifest, contextIndex: derived.contextIndex };
};

// ----- diff -----

const packIssue = (
  level: ProjectLayerPackIssueLevel,
  code: string,
  message: string,
): ProjectLayerPackIssue => ({
  level,
  code,
  message,
});

export const diffProjectLayerPack = (params: {
  basePath: string;
  packId?: string;
  packsDir?: string;
}): ProjectLayerPackReport => {
  const manifest = requireProjectLayerManifest(params.basePath);
  const targets = params.packId ? manifest.packs.filter((pack) => pack.id === params.packId) : manifest.packs;
  const issues: ProjectLayerPackIssue[] = [];

  if (targets.length === 0) {
    return { issues: [packIssue('warning', 'missing-pack', '비교할 설치된 pack이 없습니다.')] };
  }

  for (const record of targets) {
    const pack = resolvePackById(params.packsDir ?? DEFAULT_PACKS_DIR, record.id);
    if (record.sourceHash !== pack.sourceHash) {
      issues.push(
        packIssue('warning', 'pack-source-hash-drift', `${record.id} sourceHash 변경: ${record.sourceHash} -> ${pack.sourceHash}`),
      );
    }

    for (const file of [...record.documents, ...record.files]) {
      const absolutePath = resolveProjectLayerFilePath(params.basePath, file.path);
      if (!existsSync(absolutePath)) {
        issues.push(packIssue('error', 'missing-file', `파일 없음: ${file.path}`));
      }
    }
  }

  return { issues };
};
