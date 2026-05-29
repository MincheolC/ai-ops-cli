import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { isSafeProjectLayerPath } from "@/core/schemas/index.js";
import { CONTEXT_LAYER_DATA_DIR, PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH, PROJECT_LAYER_MANIFEST_RELATIVE_PATH } from "./constants.js";

// ----- path helpers -----

export const resolveProjectLayerManifestPath = (basePath: string): string =>
  join(basePath, PROJECT_LAYER_MANIFEST_RELATIVE_PATH);

export const resolveProjectLayerContextIndexPath = (basePath: string): string =>
  join(basePath, PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH);

export const resolveTemplatePath = (relativePath: string): string => join(CONTEXT_LAYER_DATA_DIR, relativePath);

export const toRelativeDir = (relativePath: string): string => dirname(relativePath);

export const resolveProjectLayerFilePath = (basePath: string, relativePath: string): string => {
  if (!isSafeProjectLayerPath(relativePath)) {
    throw new Error(`Unsafe project layer path: ${relativePath}`);
  }

  const absoluteBasePath = resolve(basePath);
  const absolutePath = resolve(absoluteBasePath, relativePath);
  const relativeFromBase = relative(absoluteBasePath, absolutePath);

  if (relativeFromBase === '' || relativeFromBase.startsWith('..') || isAbsolute(relativeFromBase)) {
    throw new Error(`Unsafe project layer path: ${relativePath}`);
  }

  return absolutePath;
};
