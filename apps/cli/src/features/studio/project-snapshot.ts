import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { ProjectLayerContextIndexSchema, ProjectLayerDocumentStatusSchema } from "@/core/schemas/index.js";
import type { ProjectLayerContextDocument, ProjectLayerManifest, StudioProjectDocument, StudioProjectDocumentProvenance, StudioProjectSnapshot, StudioSourceState } from "@/core/schemas/index.js";
import { PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH, PROJECT_LAYER_MANIFEST_RELATIVE_PATH, auditProjectLayer, parseProjectLayerDocument, readProjectLayerManifest, resolveProjectLayerContextIndexPath, resolveProjectLayerFilePath, resolveProjectLayerManifestPath } from "../project-layer/index.js";
import { buildKnownAuditPaths, normalizeStudioProjectIssue } from "./issue-normalization.js";
import { DOCS_STATUS_RELATIVE_PATH, buildSourceState, createMissingSourceState, getErrorMessage, getTrustWarning, hasErrors, hasWarnings } from "./snapshot-shared.js";
import type { ProjectContextIndexReadResult, ProjectManifestReadResult } from "./snapshot-shared.js";

const RecoverableContextDocumentSchema = z
  .object({
    status: ProjectLayerDocumentStatusSchema,
    layer: z.string().min(1),
    owner: z.string().min(1),
    read_when: z.array(z.string().min(1)),
    update_when: z.array(z.string().min(1)),
    path: z.string().min(1),
    contentHash: z.string().min(1),
  });

const RecoverableContextIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('context-layer-index'),
    documents: z.array(z.unknown()),
    generatedAt: z.string().min(1),
  });

// ----- project snapshot -----

const readProjectManifestSnapshot = (basePath: string): ProjectManifestReadResult => {
  const manifestPath = resolveProjectLayerManifestPath(basePath);
  if (!existsSync(manifestPath)) {
    return {
      source: createMissingSourceState(PROJECT_LAYER_MANIFEST_RELATIVE_PATH),
      manifest: null,
    };
  }

  try {
    const manifest = readProjectLayerManifest(basePath);
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
        exists: true,
        parsed: manifest !== null,
        generatedAt: manifest?.generatedAt ?? null,
      }),
      manifest,
    };
  } catch (error) {
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_MANIFEST_RELATIVE_PATH,
        exists: true,
        parsed: false,
        error: getErrorMessage(error),
      }),
      manifest: null,
    };
  }
};

const readProjectContextIndexSnapshot = (basePath: string): ProjectContextIndexReadResult => {
  const contextIndexPath = resolveProjectLayerContextIndexPath(basePath);
  if (!existsSync(contextIndexPath)) {
    return {
      source: createMissingSourceState(PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH),
      contextIndex: null,
    };
  }

  try {
    const parsedJson: unknown = JSON.parse(readFileSync(contextIndexPath, 'utf-8'));
    const strictContextIndex = ProjectLayerContextIndexSchema.safeParse(parsedJson);
    if (strictContextIndex.success) {
      return {
        source: buildSourceState({
          path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
          exists: true,
          parsed: true,
          generatedAt: strictContextIndex.data.generatedAt,
        }),
        contextIndex: strictContextIndex.data,
      };
    }

    const recoverableContextIndex = RecoverableContextIndexSchema.safeParse(parsedJson);
    if (!recoverableContextIndex.success) {
      return {
        source: buildSourceState({
          path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
          exists: true,
          parsed: false,
          error: strictContextIndex.error.message,
        }),
        contextIndex: null,
      };
    }

    const documents = recoverableContextIndex.data.documents.flatMap((document): ProjectLayerContextDocument[] => {
      const parsedDocument = RecoverableContextDocumentSchema.safeParse(document);
      return parsedDocument.success ? [parsedDocument.data] : [];
    });

    return {
      source: buildSourceState({
        path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
        exists: true,
        parsed: false,
        generatedAt: recoverableContextIndex.data.generatedAt,
        error: strictContextIndex.error.message,
      }),
      contextIndex: {
        schemaVersion: 1,
        kind: 'context-layer-index',
        documents,
        generatedAt: recoverableContextIndex.data.generatedAt,
      },
    };
  } catch (error) {
    return {
      source: buildSourceState({
        path: PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH,
        exists: true,
        parsed: false,
        error: getErrorMessage(error),
      }),
      contextIndex: null,
    };
  }
};

const readDocsStatusSourceState = (basePath: string): StudioSourceState => {
  const docsStatusPath = resolveProjectLayerFilePath(basePath, DOCS_STATUS_RELATIVE_PATH);
  if (!existsSync(docsStatusPath)) {
    return createMissingSourceState(DOCS_STATUS_RELATIVE_PATH);
  }

  try {
    parseProjectLayerDocument(DOCS_STATUS_RELATIVE_PATH, readFileSync(docsStatusPath, 'utf-8'));
    return buildSourceState({
      path: DOCS_STATUS_RELATIVE_PATH,
      exists: true,
      parsed: true,
    });
  } catch (error) {
    return buildSourceState({
      path: DOCS_STATUS_RELATIVE_PATH,
      exists: true,
      parsed: false,
      error: getErrorMessage(error),
    });
  }
};

const buildDocumentProvenance = (
  manifest: ProjectLayerManifest | null,
  path: string,
): StudioProjectDocumentProvenance => {
  if (manifest?.managed_files.some((file) => file.path === path) === true) {
    return 'ai-ops-managed';
  }
  if (manifest?.project_files.some((file) => file.path === path) === true) {
    return 'project-owned';
  }
  if (manifest?.packs.some((pack) => pack.documents.some((document) => document.path === path)) === true) {
    return 'pack-document';
  }
  return 'context-only';
};

const buildDocumentReadError = (code: string, message: string): string => `${code}: ${message}`;

const buildProjectDocumentSnapshot = (params: {
  basePath: string;
  indexed: ProjectLayerContextDocument;
  provenance: StudioProjectDocumentProvenance;
}): StudioProjectDocument => {
  let absolutePath: string;
  try {
    absolutePath = resolveProjectLayerFilePath(params.basePath, params.indexed.path);
  } catch (error) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('unsafe-path', getErrorMessage(error)),
    };
  }

  if (!existsSync(absolutePath)) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('missing-file', `파일 없음: ${params.indexed.path}`),
    };
  }

  try {
    const document = parseProjectLayerDocument(params.indexed.path, readFileSync(absolutePath, 'utf-8'));
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: document.contentHash,
      contentHashMatches: document.contentHash === params.indexed.contentHash,
      provenance: params.provenance,
      content: document.content,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: null,
    };
  } catch (error) {
    return {
      path: params.indexed.path,
      status: params.indexed.status,
      layer: params.indexed.layer,
      owner: params.indexed.owner,
      read_when: params.indexed.read_when,
      update_when: params.indexed.update_when,
      indexedContentHash: params.indexed.contentHash,
      currentContentHash: null,
      contentHashMatches: null,
      provenance: params.provenance,
      content: null,
      trustWarning: getTrustWarning(params.indexed.status),
      readError: buildDocumentReadError('invalid-frontmatter', getErrorMessage(error)),
    };
  }
};

const resolveProjectState = (params: {
  manifest: ProjectManifestReadResult;
  contextIndex: ProjectContextIndexReadResult;
  docsStatus: StudioSourceState;
  documents: readonly StudioProjectDocument[];
  hasAuditErrors: boolean;
}): StudioProjectSnapshot['state'] => {
  const isUninitialized = !params.manifest.source.exists && !params.contextIndex.source.exists;
  if (isUninitialized) {
    return 'uninitialized';
  }

  const hasParseError =
    (params.manifest.source.exists && !params.manifest.source.parsed) ||
    (params.contextIndex.source.exists && !params.contextIndex.source.parsed) ||
    (params.docsStatus.exists && !params.docsStatus.parsed);
  const hasDocumentReadError = params.documents.some((document) => document.readError !== null);
  if (hasParseError || params.hasAuditErrors || hasDocumentReadError) {
    return 'degraded';
  }

  return 'ready';
};

export const buildProjectSnapshot = (basePath: string): StudioProjectSnapshot => {
  const root = resolve(basePath);
  const manifest = readProjectManifestSnapshot(root);
  const contextIndex = readProjectContextIndexSnapshot(root);
  const docsStatus = readDocsStatusSourceState(root);
  const auditReport = auditProjectLayer(root);
  const documents =
    contextIndex.contextIndex?.documents.map((indexed) =>
      buildProjectDocumentSnapshot({
        basePath: root,
        indexed,
        provenance: buildDocumentProvenance(manifest.manifest, indexed.path),
      }),
    ) ?? [];
  const auditHasErrors = hasErrors(auditReport.issues);
  const knownAuditPaths = buildKnownAuditPaths({
    manifest: manifest.manifest,
    contextIndex: contextIndex.contextIndex,
    documents,
  });
  const auditIssues = auditReport.issues.map((issue) => normalizeStudioProjectIssue(issue, knownAuditPaths));

  return {
    root,
    state: resolveProjectState({
      manifest,
      contextIndex,
      docsStatus,
      documents,
      hasAuditErrors: auditHasErrors,
    }),
    files: {
      manifest: manifest.source,
      contextIndex: contextIndex.source,
      docsStatus,
    },
    audit: {
      currentSourceHash: auditReport.currentSourceHash,
      hasErrors: auditHasErrors,
      hasWarnings: hasWarnings(auditIssues),
      issues: auditIssues,
    },
    documents,
  };
};
