import { existsSync, readFileSync } from "node:fs";
import { parseAiOpsMeta } from "./managed-header.js";
import type { ProjectLayerContextDocument, ProjectLayerContextIndex, ProjectLayerManifest } from "@/core/schemas/index.js";
import { PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH, PROJECT_LAYER_MANIFEST_RELATIVE_PATH } from "./constants.js";
import { computeProjectLayerSourceHash, loadProjectLayerTemplateSpecs } from "./templates.js";
import { parseProjectLayerDocument } from "./document.logic.js";
import { resolveProjectLayerFilePath } from "./path.util.js";
import { collectDocumentPathsFromManifest, readProjectLayerContextIndex, readProjectLayerManifest } from "./state-io.js";
import { compareDocsStatusEntry, parseDocsStatusEntries } from "./docs-status.logic.js";
import type {
  DocsStatusEntry,
  ProjectLayerDocumentReadResult,
  ProjectLayerIssue,
  ProjectLayerIssueLevel,
  ProjectLayerReport,
} from './types.js';

// ----- diff and audit -----

export const issue = (level: ProjectLayerIssueLevel, code: string, message: string): ProjectLayerIssue => ({
  level,
  code,
  message,
});

const readDocumentSafely = (basePath: string, path: string): ProjectLayerDocumentReadResult | ProjectLayerIssue => {
  try {
    const absolutePath = resolveProjectLayerFilePath(basePath, path);
    if (!existsSync(absolutePath)) {
      return issue('error', 'missing-file', `파일 없음: ${path}`);
    }

    return parseProjectLayerDocument(path, readFileSync(absolutePath, 'utf-8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return issue('error', 'invalid-frontmatter', `${path} frontmatter 파싱 실패: ${reason}`);
  }
};

const buildContextIndexMap = (contextIndex: ProjectLayerContextIndex | null): Map<string, ProjectLayerContextDocument> =>
  new Map((contextIndex?.documents ?? []).map((document) => [document.path, document]));

const compareArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const compareContextDocument = (params: {
  expected: ProjectLayerDocumentReadResult;
  indexed: ProjectLayerContextDocument | undefined;
}): ProjectLayerIssue[] => {
  const indexed = params.indexed;
  if (indexed === undefined) {
    return [issue('error', 'context-missing-document', `context-layer 누락: ${params.expected.path}`)];
  }

  const issues: ProjectLayerIssue[] = [];
  const scalarKeys = ['status', 'layer', 'owner', 'contentHash'] as const;

  for (const key of scalarKeys) {
    if (params.expected[key] !== indexed[key]) {
      issues.push(
        issue('error', 'context-document-mismatch', `${params.expected.path} context ${key} 불일치`),
      );
    }
  }

  if (!compareArray(params.expected.read_when, indexed.read_when)) {
    issues.push(issue('error', 'context-document-mismatch', `${params.expected.path} context read_when 불일치`));
  }

  if (!compareArray(params.expected.update_when, indexed.update_when)) {
    issues.push(issue('error', 'context-document-mismatch', `${params.expected.path} context update_when 불일치`));
  }

  return issues;
};

export const diffProjectLayer = (basePath: string): ProjectLayerReport => {
  let manifest: ProjectLayerManifest | null;
  try {
    manifest = readProjectLayerManifest(basePath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return {
      currentSourceHash: null,
      issues: [issue('error', 'invalid-manifest', `${PROJECT_LAYER_MANIFEST_RELATIVE_PATH} 파싱 실패: ${reason}`)],
    };
  }

  if (!manifest) {
    return {
      currentSourceHash: null,
      issues: [issue('error', 'missing-manifest', `${PROJECT_LAYER_MANIFEST_RELATIVE_PATH}가 없습니다.`)],
    };
  }

  const specs = loadProjectLayerTemplateSpecs(manifest.tools);
  const currentSourceHash = computeProjectLayerSourceHash(specs);
  let contextIndex: ProjectLayerContextIndex | null = null;
  const issues: ProjectLayerIssue[] = [];

  try {
    contextIndex = readProjectLayerContextIndex(basePath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    issues.push(
      issue('error', 'invalid-context-index', `${PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH} 파싱 실패: ${reason}`),
    );
  }

  const contextMap = buildContextIndexMap(contextIndex);
  const expectedManagedPaths = new Set(specs.filter((spec) => spec.ownership === 'managed').map((spec) => spec.path));
  const manifestManagedPaths = new Set(manifest.managed_files.map((file) => file.path));

  if (manifest.sourceHash !== currentSourceHash) {
    issues.push(
      issue('warning', 'source-hash-drift', `template sourceHash 변경: ${manifest.sourceHash} -> ${currentSourceHash}`),
    );
  }

  if (contextIndex === null) {
    issues.push(issue('error', 'missing-context-index', `${PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH}가 없습니다.`));
  }

  for (const expectedPath of expectedManagedPaths) {
    if (!manifestManagedPaths.has(expectedPath)) {
      issues.push(issue('error', 'manifest-missing-managed-file', `manifest managed_files 누락: ${expectedPath}`));
    }
  }

  for (const file of manifest.managed_files) {
    const absolutePath = resolveProjectLayerFilePath(basePath, file.path);
    if (!existsSync(absolutePath)) {
      issues.push(issue('error', 'missing-file', `파일 없음: ${file.path}`));
      continue;
    }

    const content = readFileSync(absolutePath, 'utf-8');
    const meta = parseAiOpsMeta(content);
    if (!meta) {
      issues.push(issue('error', 'missing-managed-section', `managed section 메타 없음: ${file.path}`));
      continue;
    }

    if (meta.sourceHash !== currentSourceHash) {
      issues.push(
        issue('warning', 'managed-source-hash-drift', `${file.path} sourceHash 변경: ${meta.sourceHash} -> ${currentSourceHash}`),
      );
    }
  }

  for (const file of manifest.project_files) {
    if (!existsSync(resolveProjectLayerFilePath(basePath, file.path))) {
      issues.push(issue('error', 'missing-file', `파일 없음: ${file.path}`));
    }
  }

  for (const pack of manifest.packs) {
    for (const file of [...pack.documents, ...pack.files]) {
      if (!existsSync(resolveProjectLayerFilePath(basePath, file.path))) {
        issues.push(issue('error', 'missing-file', `파일 없음: ${file.path}`));
      }
    }
  }

  for (const path of collectDocumentPathsFromManifest(manifest)) {
    const document = readDocumentSafely(basePath, path);
    if ('code' in document) {
      issues.push(document);
      continue;
    }
    issues.push(...compareContextDocument({ expected: document, indexed: contextMap.get(path) }));
  }

  return { currentSourceHash, issues };
};

export const auditProjectLayer = (basePath: string): ProjectLayerReport => {
  const diffReport = diffProjectLayer(basePath);
  let manifest: ProjectLayerManifest | null;
  try {
    manifest = readProjectLayerManifest(basePath);
  } catch {
    return diffReport;
  }

  if (!manifest) {
    return diffReport;
  }

  let contextIndex: ProjectLayerContextIndex | null = null;
  try {
    contextIndex = readProjectLayerContextIndex(basePath);
  } catch {
    contextIndex = null;
  }
  const documentPaths = collectDocumentPathsFromManifest(manifest);
  const documentPathSet = new Set(documentPaths);
  const contextPathSet = new Set(contextIndex?.documents.map((document) => document.path) ?? []);
  const issues = [...diffReport.issues];
  const docsStatusPath = resolveProjectLayerFilePath(basePath, 'docs/docs-status.md');

  if (!existsSync(docsStatusPath)) {
    issues.push(issue('error', 'missing-docs-status', 'docs/docs-status.md가 없습니다.'));
    return { currentSourceHash: diffReport.currentSourceHash, issues };
  }

  let docsStatusEntries: DocsStatusEntry[] = [];
  try {
    docsStatusEntries = parseDocsStatusEntries(readFileSync(docsStatusPath, 'utf-8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    issues.push(issue('error', 'invalid-docs-status', `docs/docs-status.md 파싱 실패: ${reason}`));
  }

  const docsStatusMap = new Map(docsStatusEntries.map((entry) => [entry.path, entry]));

  for (const path of documentPaths) {
    const document = readDocumentSafely(basePath, path);
    if ('code' in document) {
      continue;
    }

    issues.push(...compareDocsStatusEntry({ expected: document, entry: docsStatusMap.get(path) }));
  }

  for (const entry of docsStatusEntries) {
    if (!documentPathSet.has(entry.path)) {
      issues.push(issue('warning', 'docs-status-extra-document', `docs-status에 manifest 외 문서가 있습니다: ${entry.path}`));
    }
  }

  for (const contextPath of contextPathSet) {
    if (!documentPathSet.has(contextPath)) {
      issues.push(issue('warning', 'context-extra-document', `context-layer에 manifest 외 문서가 있습니다: ${contextPath}`));
    }
  }

  return { currentSourceHash: diffReport.currentSourceHash, issues };
};
