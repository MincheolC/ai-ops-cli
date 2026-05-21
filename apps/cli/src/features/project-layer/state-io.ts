import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { computeHash } from "@/shared/source-hash.js";
import { ProjectLayerContextIndexSchema } from "@/core/schemas/index.js";
import type { ProjectLayerContextIndex, ProjectLayerManifest } from "@/core/schemas/index.js";
import { parseProjectLayerContextIndex, parseProjectLayerManifest, serializeProjectLayerContextIndex, serializeProjectLayerManifest } from "./serialization.js";
import { parseProjectLayerDocument } from "./document.logic.js";
import { resolveProjectLayerContextIndexPath, resolveProjectLayerFilePath, resolveProjectLayerManifestPath } from "./path.util.js";
import { updateDocsStatusProjectFileRecord, updateDocsStatusTable } from "./docs-status.logic.js";

// ----- manifest and index I/O -----

export const readProjectLayerManifest = (basePath: string): ProjectLayerManifest | null => {
  try {
    return parseProjectLayerManifest(readFileSync(resolveProjectLayerManifestPath(basePath), 'utf-8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

export const writeProjectLayerManifest = (basePath: string, manifest: ProjectLayerManifest): void => {
  const manifestPath = resolveProjectLayerManifestPath(basePath);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, serializeProjectLayerManifest(manifest), 'utf-8');
};

export const readProjectLayerContextIndex = (basePath: string): ProjectLayerContextIndex | null => {
  try {
    return parseProjectLayerContextIndex(readFileSync(resolveProjectLayerContextIndexPath(basePath), 'utf-8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

export const writeProjectLayerContextIndex = (basePath: string, contextIndex: ProjectLayerContextIndex): void => {
  const contextIndexPath = resolveProjectLayerContextIndexPath(basePath);
  mkdirSync(dirname(contextIndexPath), { recursive: true });
  writeFileSync(contextIndexPath, serializeProjectLayerContextIndex(contextIndex), 'utf-8');
};

// ----- install and update -----

export const buildContextIndexFromDisk = (params: {
  basePath: string;
  documentPaths: readonly string[];
  generatedAt: string;
}): ProjectLayerContextIndex => {
  const documents = params.documentPaths.map((path) =>
    parseProjectLayerDocument(path, readFileSync(resolveProjectLayerFilePath(params.basePath, path), 'utf-8')),
  );

  return ProjectLayerContextIndexSchema.parse({
    schemaVersion: 1,
    kind: 'context-layer-index',
    documents: documents.map(({ content: _content, ...document }) => document),
    generatedAt: params.generatedAt,
  });
};

export const computeProjectFileHash = (basePath: string, relativePath: string): string =>
  computeHash([readFileSync(resolveProjectLayerFilePath(basePath, relativePath), 'utf-8').trimEnd()]);

export const collectDocumentPathsFromManifest = (manifest: ProjectLayerManifest): string[] =>
  [
    ...manifest.managed_files.map((file) => file.path),
    ...manifest.project_files.map((file) => file.path),
    ...manifest.packs.flatMap((pack) => pack.documents.map((file) => file.path)),
  ].sort();

export const refreshProjectLayerDerivedState = (params: {
  basePath: string;
  manifest: ProjectLayerManifest;
  generatedAt: string;
}): {
  manifest: ProjectLayerManifest;
  contextIndex: ProjectLayerContextIndex;
} => {
  const documentPaths = collectDocumentPathsFromManifest(params.manifest);
  const docsStatusHashes = updateDocsStatusTable(params.basePath, documentPaths);
  const manifest = updateDocsStatusProjectFileRecord({
    manifest: params.manifest,
    beforeHash: docsStatusHashes.beforeHash,
    afterHash: docsStatusHashes.afterHash,
  });
  const contextIndex = buildContextIndexFromDisk({
    basePath: params.basePath,
    documentPaths,
    generatedAt: params.generatedAt,
  });

  writeProjectLayerContextIndex(params.basePath, contextIndex);

  return {
    manifest,
    contextIndex,
  };
};
