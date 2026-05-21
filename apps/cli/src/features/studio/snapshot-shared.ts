import { join } from "node:path";
import type { ProjectLayerContextDocument, ProjectLayerManifest, StudioSourceState } from "@/core/schemas/index.js";

// ----- types -----

export type BuildStudioSnapshotParams = {
  basePath: string;
  userBasePath?: string | null;
  codexHomePath?: string | null;
  generatedAt?: string;
  cliVersion?: string;
};

export type ProjectManifestReadResult = {
  source: StudioSourceState;
  manifest: ProjectLayerManifest | null;
};

export type ProjectContextIndexReadResult = {
  source: StudioSourceState;
  contextIndex: ProjectLayerContextIndex | null;
};

export type RuntimeReadResult<T> = {
  source: StudioSourceState;
  value: T | null;
};

export const DOCS_STATUS_RELATIVE_PATH = "docs/docs-status.md";

// ----- shared helpers -----

export const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'unknown error');

export const resolveDefaultUserBasePath = (): string | null => process.env.AI_OPS_HOME ?? process.env.HOME ?? null;

export const resolveDefaultCodexHomePath = (): string | null => {
  if (process.env.CODEX_HOME && process.env.CODEX_HOME.length > 0) {
    return process.env.CODEX_HOME;
  }
  if (process.env.HOME && process.env.HOME.length > 0) {
    return join(process.env.HOME, '.codex');
  }
  return null;
};

export const buildSourceState = (params: {
  path: string;
  exists: boolean;
  parsed: boolean;
  generatedAt?: string | null;
  error?: string | null;
}): StudioSourceState => ({
  path: params.path,
  exists: params.exists,
  parsed: params.parsed,
  generatedAt: params.generatedAt ?? null,
  error: params.error ?? null,
});

export const createMissingSourceState = (path: string): StudioSourceState =>
  buildSourceState({ path, exists: false, parsed: false });

export const createUnavailableSourceState = (params: { path: string; reason: string }): StudioSourceState =>
  buildSourceState({
    path: params.path,
    exists: false,
    parsed: false,
    error: params.reason,
  });

export const hasErrors = (issues: readonly { level: string }[]): boolean => issues.some((issue) => issue.level === 'error');

export const hasWarnings = (issues: readonly { level: string }[]): boolean => issues.some((issue) => issue.level === 'warning');

export const getTrustWarning = (status: ProjectLayerContextDocument['status']): string | null => {
  if (status === 'Reserved') {
    return 'Reserved document is not current decision-making evidence.';
  }
  if (status === 'Draft') {
    return 'Draft document requires review before use as decision-making evidence.';
  }
  if (status === 'Archived') {
    return 'Archived document is historical record and should not guide current operation.';
  }
  return null;
};

export const uniqueStrings = (values: readonly string[]): string[] => [...new Set(values.filter((value) => value.length > 0))];
