import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { computeHash } from "@/shared/source-hash.js";
import type { ProjectLayerManifest, ProjectLayerPackFileRecord, ProjectLayerProjectFile } from "@/core/schemas/index.js";
import { PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH, PROJECT_LAYER_MANIFEST_RELATIVE_PATH } from "./constants.js";
import { hasAiOpsSection, stripAiOpsSection } from "./managed-header.js";
import { resolveProjectLayerFilePath, toRelativeDir } from "./path.util.js";
import type { ProjectLayerRemoveResult } from "./types.js";

// ----- uninstall -----

export function removeManagedProjectFile(basePath: string, relativePath: string): ProjectLayerRemoveResult {
  const absolutePath = resolveProjectLayerFilePath(basePath, relativePath);
  if (!existsSync(absolutePath)) {
    return { deleted: [], cleaned: [], preserved: [], notFound: [relativePath] };
  }

  const content = readFileSync(absolutePath, 'utf-8');
  if (!hasAiOpsSection(content)) {
    return { deleted: [], cleaned: [], preserved: [relativePath], notFound: [] };
  }

  const stripped = stripAiOpsSection(content);
  if (stripped.trim().length === 0) {
    rmSync(absolutePath);
    return { deleted: [relativePath], cleaned: [], preserved: [], notFound: [] };
  }

  writeFileSync(absolutePath, stripped, 'utf-8');
  return { deleted: [], cleaned: [relativePath], preserved: [], notFound: [] };
}

const removeCreateOnlyProjectFile = (basePath: string, file: ProjectLayerProjectFile): ProjectLayerRemoveResult => {
  const absolutePath = resolveProjectLayerFilePath(basePath, file.path);
  if (!existsSync(absolutePath)) {
    return { deleted: [], cleaned: [], preserved: [], notFound: [file.path] };
  }

  const content = readFileSync(absolutePath, 'utf-8').trimEnd();
  const currentHash = computeHash([content]);
  if (file.created && currentHash === file.templateHash) {
    rmSync(absolutePath);
    return { deleted: [file.path], cleaned: [], preserved: [], notFound: [] };
  }

  return { deleted: [], cleaned: [], preserved: [file.path], notFound: [] };
};

const removePackOwnedFile = (basePath: string, file: ProjectLayerPackFileRecord): ProjectLayerRemoveResult => {
  const absolutePath = resolveProjectLayerFilePath(basePath, file.path);
  if (!existsSync(absolutePath)) {
    return { deleted: [], cleaned: [], preserved: [], notFound: [file.path] };
  }

  const currentHash = computeHash([readFileSync(absolutePath, 'utf-8').trimEnd()]);
  if (currentHash === file.sourceHash) {
    rmSync(absolutePath);
    return { deleted: [file.path], cleaned: [], preserved: [], notFound: [] };
  }

  return { deleted: [], cleaned: [], preserved: [file.path], notFound: [] };
};

const mergeRemoveResults = (results: readonly ProjectLayerRemoveResult[]): ProjectLayerRemoveResult => ({
  deleted: results.flatMap((result) => result.deleted),
  cleaned: results.flatMap((result) => result.cleaned),
  preserved: results.flatMap((result) => result.preserved),
  notFound: results.flatMap((result) => result.notFound),
});

const removeEmptyDirs = (basePath: string, relativePaths: readonly string[]): void => {
  const dirs = [...new Set(relativePaths.map(toRelativeDir).filter((dir) => dir !== '.'))].sort(
    (a, b) => b.length - a.length,
  );

  for (const dir of [...dirs, '.ai-ops']) {
    const absoluteDir = resolveProjectLayerFilePath(basePath, dir);
    if (!existsSync(absoluteDir)) continue;

    try {
      if (readdirSync(absoluteDir).length === 0) {
        rmSync(absoluteDir, { recursive: true });
      }
    } catch {
      // Ignore cleanup failures.
    }
  }
};

export const uninstallProjectLayer = (basePath: string, manifest: ProjectLayerManifest): ProjectLayerRemoveResult => {
  const managedResults = manifest.managed_files.map((file) => removeManagedProjectFile(basePath, file.path));
  const projectResults = manifest.project_files.map((file) => removeCreateOnlyProjectFile(basePath, file));
  const packResults = manifest.packs.flatMap((pack) =>
    [...pack.documents, ...pack.files].map((file) => removePackOwnedFile(basePath, file)),
  );
  const stateFiles = [PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH, PROJECT_LAYER_MANIFEST_RELATIVE_PATH];

  for (const stateFile of stateFiles) {
    rmSync(resolveProjectLayerFilePath(basePath, stateFile), { force: true });
  }

  const result = mergeRemoveResults([...managedResults, ...projectResults, ...packResults]);
  removeEmptyDirs(basePath, [...result.deleted, ...stateFiles]);
  return result;
};
