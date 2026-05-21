import { readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { PackCatalogSchema, ProjectLayerFrontmatterSchema, isSafeProjectLayerPath } from '@/core/schemas/index.js';
import type { PackCatalog } from '@/core/schemas/index.js';
import { parseMarkdownFrontmatter } from '@/shared/markdown/frontmatter.js';
import { COMPILER_DATA_DIR } from '@/shared/paths.js';
import { computeHash } from '@/shared/source-hash.js';

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

const PACK_REGISTRY_FILENAME = 'pack-registry.json';
const SPEC_LIFECYCLE_PACK_ID = 'spec-lifecycle';
const PACK_INSTALL_ROOT = 'docs/specs/';
const RESERVED_DOCUMENT_WARNINGS = [
  '판단 근거로 사용하지 마세요',
  'Do not use this document as current decision-making evidence',
] as const;

export const DEFAULT_PACKS_DIR = join(COMPILER_DATA_DIR, 'packs');

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

export const resolvePackById = (packsDir: string, packId: string): ProjectLayerPackSource => {
  const pack = loadAllPacks(packsDir).find((candidate) => candidate.id === packId);
  if (!pack) {
    throw new Error(`Unknown pack: ${packId}`);
  }
  return pack;
};
