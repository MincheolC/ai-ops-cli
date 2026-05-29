import {
  PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
  PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
  resolveProjectLayerFilePath,
} from "../project-layer/index.js";
import type { ProjectLayerContextIndex, ProjectLayerManifest, StudioProjectDocument, StudioProjectIssue, StudioProjectIssueSource } from "@/core/schemas/index.js";
import type { ProjectLayerIssue } from "../project-layer/index.js";
import { DOCS_STATUS_RELATIVE_PATH, uniqueStrings } from "./snapshot-shared.js";

const AUDIT_ISSUE_SOURCES_BY_CODE = {
  'missing-manifest': 'manifest',
  'invalid-manifest': 'manifest',
  'manifest-missing-managed-file': 'manifest',
  'missing-context-index': 'context-layer',
  'invalid-context-index': 'context-layer',
  'context-missing-document': 'context-layer',
  'context-document-mismatch': 'context-layer',
  'context-extra-document': 'context-layer',
  'missing-docs-status': 'docs-status',
  'invalid-docs-status': 'docs-status',
  'docs-status-missing-document': 'docs-status',
  'docs-status-mismatch': 'docs-status',
  'docs-status-extra-document': 'docs-status',
  'missing-file': 'file-system',
  'invalid-frontmatter': 'frontmatter',
  'missing-managed-section': 'managed-section',
  'source-hash-drift': 'source-hash',
  'managed-source-hash-drift': 'source-hash',
  'invalid-custom-project-rule': 'frontmatter',
  'custom-project-rules-drift': 'manifest',
} as const satisfies Record<string, StudioProjectIssueSource>;

const AUDIT_ISSUE_ACTION_LABELS_BY_SOURCE = {
  manifest: 'Review manifest record',
  'context-layer': 'Review context index',
  'docs-status': 'Review docs status',
  frontmatter: 'Review frontmatter',
  'managed-section': 'Review managed section',
  'file-system': 'Review missing file',
  'source-hash': 'Review source hash',
  unknown: null,
} as const satisfies Record<StudioProjectIssueSource, string | null>;

const getManifestDocumentPaths = (manifest: ProjectLayerManifest | null): string[] =>
  manifest === null
    ? []
    : [
        ...manifest.managed_files.map((file) => file.path),
        ...manifest.project_files.map((file) => file.path),
        ...manifest.packs.flatMap((pack) => pack.documents.map((file) => file.path)),
        ...manifest.packs.flatMap((pack) => pack.files.map((file) => file.path)),
      ];

export const buildKnownAuditPaths = (params: {
  manifest: ProjectLayerManifest | null;
  contextIndex: ProjectLayerContextIndex | null;
  documents: readonly StudioProjectDocument[];
}): string[] =>
  uniqueStrings([
    PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
    PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
    DOCS_STATUS_RELATIVE_PATH,
    ...getManifestDocumentPaths(params.manifest),
    ...(params.contextIndex?.documents.map((document) => document.path) ?? []),
    ...params.documents.map((document) => document.path),
  ]).sort((left, right) => right.length - left.length || left.localeCompare(right));

const findKnownPathInMessage = (message: string, knownPaths: readonly string[]): string | null =>
  knownPaths.find((path) => message.includes(path)) ?? null;

const parsePathLikeToken = (value: string): string | null => {
  const trimmed = value.trim().replace(/[.,;)]$/, '');
  if (trimmed.length === 0) {
    return null;
  }

  try {
    resolveProjectLayerFilePath('/', trimmed);
    return trimmed;
  } catch {
    return null;
  }
};

const extractTrailingIssuePath = (message: string): string | null => {
  const trailingSegment = message.split(':').at(-1);
  if (trailingSegment === undefined) {
    return null;
  }

  const [firstToken] = trailingSegment.trim().split(/\s+/);
  return firstToken === undefined ? null : parsePathLikeToken(firstToken);
};

const extractLeadingIssuePath = (message: string): string | null => {
  const [firstToken] = message.trim().split(/\s+/);
  return firstToken === undefined ? null : parsePathLikeToken(firstToken);
};

const resolveIssueSource = (issue: ProjectLayerIssue): StudioProjectIssueSource =>
  AUDIT_ISSUE_SOURCES_BY_CODE[issue.code] ?? 'unknown';

const resolveIssueAffectedPath = (params: {
  issue: ProjectLayerIssue;
  source: StudioProjectIssueSource;
  knownPaths: readonly string[];
}): string | null => {
  if (params.issue.code === 'missing-manifest' || params.issue.code === 'invalid-manifest') {
    return PROJECT_LAYER_MANIFEST_RELATIVE_PATH;
  }

  if (params.issue.code === 'missing-context-index' || params.issue.code === 'invalid-context-index') {
    return PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH;
  }

  if (params.issue.code === 'missing-docs-status' || params.issue.code === 'invalid-docs-status') {
    return DOCS_STATUS_RELATIVE_PATH;
  }

  if (params.issue.code === 'source-hash-drift') {
    return null;
  }

  if (params.issue.code === 'invalid-custom-project-rule') {
    return extractLeadingIssuePath(params.issue.message);
  }

  const knownPath = findKnownPathInMessage(params.issue.message, params.knownPaths);
  if (knownPath !== null) {
    return knownPath;
  }

  if (params.source === 'unknown') {
    return null;
  }

  return extractTrailingIssuePath(params.issue.message);
};

export const normalizeStudioProjectIssue = (
  issue: ProjectLayerIssue,
  knownPaths: readonly string[] = [],
): StudioProjectIssue => {
  const source = resolveIssueSource(issue);

  return {
    level: issue.level,
    code: issue.code,
    message: issue.message,
    source,
    affectedPath: resolveIssueAffectedPath({ issue, source, knownPaths }),
    suggestedActionLabel: AUDIT_ISSUE_ACTION_LABELS_BY_SOURCE[source],
  };
};
