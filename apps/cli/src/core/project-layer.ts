import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { parseMarkdownFrontmatter } from './frontmatter.js';
import {
  extractAiOpsSectionContent,
  hasAiOpsSection,
  hasLegacyHeader,
  parseAiOpsMeta,
  replaceAiOpsSection,
  stripAiOpsSection,
  wrapWithSection,
} from './managed-header.js';
import { COMPILER_DATA_DIR } from './paths.js';
import { computeHash, getCliVersion } from './source-hash.js';
import {
  ProjectLayerContextIndexSchema,
  ProjectLayerFrontmatterSchema,
  ProjectLayerManifestSchema,
  ProjectLayerToolSchema,
  isSafeProjectLayerPath,
} from './schemas/index.js';
import type {
  ProjectLayerContextDocument,
  ProjectLayerContextIndex,
  ProjectLayerFrontmatter,
  ProjectLayerManifest,
  ProjectLayerPackFileRecord,
  ProjectLayerPackRecord,
  ProjectLayerProjectFile,
  ProjectLayerTool,
} from './schemas/index.js';

// ----- types -----

export type ProjectLayerFileOwnership = 'managed' | 'project';

export type ProjectLayerTemplateSpec = {
  path: string;
  content: string;
  ownership: ProjectLayerFileOwnership;
  frontmatter: ProjectLayerFrontmatter;
  contentHash: string;
};

export type ProjectLayerInstallResult = {
  manifest: ProjectLayerManifest;
  contextIndex: ProjectLayerContextIndex;
  written: string[];
  appended: string[];
  createdProjectFiles: string[];
  refreshedProjectFiles: string[];
  preservedProjectFiles: string[];
};

export type ProjectLayerRemoveResult = {
  deleted: string[];
  cleaned: string[];
  preserved: string[];
  notFound: string[];
};

export type ProjectLayerIssueLevel = 'error' | 'warning';

export type ProjectLayerIssue = {
  level: ProjectLayerIssueLevel;
  code: string;
  message: string;
};

export type ProjectLayerReport = {
  currentSourceHash: string | null;
  issues: ProjectLayerIssue[];
};

type DocsStatusEntry = {
  path: string;
  status: string;
  owner: string;
};

type DocsStatusTableBounds = {
  headerIndex: number;
  dividerIndex: number;
  tableEndIndex: number;
};

type ManagedInstallResult = {
  written: string[];
  appended: string[];
};

type ProjectFileInstallResult = {
  records: ProjectLayerProjectFile[];
  created: string[];
  refreshed: string[];
  preserved: string[];
};

export type ProjectLayerDocumentReadResult = ProjectLayerContextDocument & {
  content: string;
};

// ----- constants -----

export const PROJECT_LAYER_MANIFEST_RELATIVE_PATH = '.ai-ops/manifest.json';
export const PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH = '.ai-ops/context-layer.json';

const CONTEXT_LAYER_DATA_DIR = join(COMPILER_DATA_DIR, 'context-layer');

const TOOL_ORDER = ['codex', 'gemini', 'claude-code'] as const satisfies readonly ProjectLayerTool[];

const DEFAULT_TOOLS = TOOL_ORDER;

const TEMPLATE_PATHS = [
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'docs/agent/workflow.md',
  'docs/agent/rules/00-agent-baseline.md',
  'docs/agent/rules/routing-rules.md',
  'docs/agent/rules/doc-update-rules.md',
  'docs/agent/rules/stop-rules.md',
  'docs/agent/checks/impact-checklist.md',
  'docs/agent/maps/codebase-map.md',
  'docs/business/business-rules.md',
  'docs/docs-status.md',
] as const;

const PROJECT_OWNED_PATHS = new Set<string>([
  'docs/docs-status.md',
  'docs/agent/maps/codebase-map.md',
  'docs/business/business-rules.md',
]);

const RESERVED_DOCUMENT_WARNINGS = [
  '판단 근거로 사용하지 마세요',
  'Do not use this document as current decision-making evidence',
] as const;

// ----- path helpers -----

export const resolveProjectLayerManifestPath = (basePath: string): string =>
  join(basePath, PROJECT_LAYER_MANIFEST_RELATIVE_PATH);

export const resolveProjectLayerContextIndexPath = (basePath: string): string =>
  join(basePath, PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH);

const resolveTemplatePath = (relativePath: string): string => join(CONTEXT_LAYER_DATA_DIR, relativePath);

const toRelativeDir = (relativePath: string): string => dirname(relativePath);

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

// ----- parsing and serialization -----

export const parseProjectLayerManifest = (json: string): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse(JSON.parse(json));

export const serializeProjectLayerManifest = (manifest: ProjectLayerManifest): string =>
  JSON.stringify(manifest, null, 2) + '\n';

export const parseProjectLayerContextIndex = (json: string): ProjectLayerContextIndex =>
  ProjectLayerContextIndexSchema.parse(JSON.parse(json));

export const serializeProjectLayerContextIndex = (contextIndex: ProjectLayerContextIndex): string =>
  JSON.stringify(contextIndex, null, 2) + '\n';

const parseProjectLayerFrontmatter = (content: string): ProjectLayerFrontmatter => {
  const { frontmatter } = parseMarkdownFrontmatter(content);
  return ProjectLayerFrontmatterSchema.parse(frontmatter);
};

export const parseProjectLayerDocument = (path: string, rawContent: string): ProjectLayerDocumentReadResult => {
  const managedContent = extractAiOpsSectionContent(rawContent);
  const content = managedContent ?? rawContent;
  const frontmatter = parseProjectLayerFrontmatter(content);

  return {
    path,
    status: frontmatter.status,
    layer: frontmatter.layer,
    owner: frontmatter.owner,
    read_when: frontmatter.read_when,
    update_when: frontmatter.update_when,
    contentHash: computeHash([content.trimEnd()]),
    content,
  };
};

const parseMarkdownTableCells = (line: string): string[] | null => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return null;
  }

  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
};

const isDocsStatusHeaderLine = (line: string): boolean => {
  const cells = parseMarkdownTableCells(line);
  return (
    cells !== null &&
    cells.length === 3 &&
    cells[0] === 'path' &&
    cells[1] === 'status' &&
    cells[2] === 'owner'
  );
};

const isMarkdownDividerCell = (cell: string): boolean => /^:?-{3,}:?$/.test(cell);

const isDocsStatusDividerLine = (line: string): boolean => {
  const cells = parseMarkdownTableCells(line);
  return cells !== null && cells.length === 3 && cells.every(isMarkdownDividerCell);
};

const findDocsStatusTableBounds = (lines: readonly string[]): DocsStatusTableBounds | null => {
  const headerIndex = lines.findIndex(isDocsStatusHeaderLine);
  const dividerIndex = headerIndex + 1;

  if (headerIndex < 0 || !isDocsStatusDividerLine(lines[dividerIndex] ?? '')) {
    return null;
  }

  let tableEndIndex = dividerIndex + 1;
  while (tableEndIndex < lines.length && parseMarkdownTableCells(lines[tableEndIndex] ?? '') !== null) {
    tableEndIndex += 1;
  }

  return { headerIndex, dividerIndex, tableEndIndex };
};

const parseDocsStatusEntries = (content: string): DocsStatusEntry[] => {
  const document = parseProjectLayerDocument('docs/docs-status.md', content);
  const lines = document.content.split('\n');
  const tableBounds = findDocsStatusTableBounds(lines);
  if (tableBounds === null) {
    return [];
  }

  const rows = lines.slice(tableBounds.dividerIndex + 1, tableBounds.tableEndIndex);

  return rows.flatMap((line) => {
    const cells = parseMarkdownTableCells(line);
    if (cells === null || cells.length < 3) return [];

    return [
      {
        path: cells[0],
        status: cells[1],
        owner: cells[2],
      },
    ];
  });
};

// ----- template loading -----

export const resolveProjectLayerTools = (requestedTools?: readonly string[]): ProjectLayerTool[] => {
  if (requestedTools === undefined || requestedTools.length === 0) {
    return [...DEFAULT_TOOLS];
  }

  const parsedTools = requestedTools.map((tool) => ProjectLayerToolSchema.parse(tool));
  const toolSet = new Set(parsedTools);
  return TOOL_ORDER.filter((tool) => toolSet.has(tool));
};

const shouldIncludeTemplate = (relativePath: string, tools: readonly ProjectLayerTool[]): boolean => {
  if (relativePath === 'GEMINI.md') return tools.includes('gemini');
  if (relativePath === 'CLAUDE.md') return tools.includes('claude-code');
  return true;
};

const buildDocsStatusRows = (specs: readonly ProjectLayerTemplateSpec[]): string =>
  specs.map((spec) => `| ${spec.path} | ${spec.frontmatter.status} | ${spec.frontmatter.owner} |`).join('\n');

const includesReservedDocumentWarning = (content: string): boolean =>
  RESERVED_DOCUMENT_WARNINGS.some((warning) => content.includes(warning));

const loadTemplateSpec = (relativePath: string, content: string): ProjectLayerTemplateSpec => {
  const frontmatter = parseProjectLayerFrontmatter(content);
  const ownership = PROJECT_OWNED_PATHS.has(relativePath) ? 'project' : 'managed';

  if (frontmatter.status === 'Reserved' && !includesReservedDocumentWarning(content)) {
    throw new Error(`Reserved template must include warning text: ${relativePath}`);
  }

  return {
    path: relativePath,
    content,
    ownership,
    frontmatter,
    contentHash: computeHash([content.trimEnd()]),
  };
};

export const loadProjectLayerTemplateSpecs = (
  tools: readonly ProjectLayerTool[],
): readonly ProjectLayerTemplateSpec[] => {
  const selectedPaths = TEMPLATE_PATHS.filter((relativePath) => shouldIncludeTemplate(relativePath, tools));
  const nonStatusSpecs = selectedPaths
    .filter((relativePath) => relativePath !== 'docs/docs-status.md')
    .map((relativePath) => loadTemplateSpec(relativePath, readFileSync(resolveTemplatePath(relativePath), 'utf-8')));

  const statusTemplate = readFileSync(resolveTemplatePath('docs/docs-status.md'), 'utf-8');
  const statusPlaceholderSpec = loadTemplateSpec('docs/docs-status.md', statusTemplate);
  const specsForStatus = [...nonStatusSpecs, statusPlaceholderSpec].sort((a, b) => a.path.localeCompare(b.path));
  const statusContent = statusTemplate.replace('{{documents_table}}', buildDocsStatusRows(specsForStatus));
  const statusSpec = loadTemplateSpec('docs/docs-status.md', statusContent);

  return [...nonStatusSpecs, statusSpec].sort((a, b) => a.path.localeCompare(b.path));
};

export const computeProjectLayerSourceHash = (specs: readonly ProjectLayerTemplateSpec[]): string =>
  computeHash(specs.map((spec) => `${spec.path}:${spec.content}`));

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

const installManagedFiles = (
  basePath: string,
  specs: readonly ProjectLayerTemplateSpec[],
  meta: { sourceHash: string; generatedAt: string },
): ManagedInstallResult => {
  const written: string[] = [];
  const appended: string[] = [];

  for (const spec of specs) {
    const absolutePath = resolveProjectLayerFilePath(basePath, spec.path);
    const wrappedContent = wrapWithSection(spec.content, meta);

    if (!existsSync(absolutePath)) {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, wrappedContent + '\n', 'utf-8');
      written.push(spec.path);
      continue;
    }

    const existing = readFileSync(absolutePath, 'utf-8');
    if (hasAiOpsSection(existing)) {
      writeFileSync(absolutePath, replaceAiOpsSection(existing, wrappedContent), 'utf-8');
      const stripped = stripAiOpsSection(existing);
      (stripped.trim().length > 0 ? appended : written).push(spec.path);
      continue;
    }

    if (hasLegacyHeader(existing)) {
      writeFileSync(absolutePath, wrappedContent + '\n', 'utf-8');
      written.push(spec.path);
      continue;
    }

    writeFileSync(absolutePath, existing.trimEnd() + '\n\n' + wrappedContent + '\n', 'utf-8');
    appended.push(spec.path);
  }

  return { written, appended };
};

const installProjectFiles = (params: {
  basePath: string;
  specs: readonly ProjectLayerTemplateSpec[];
  previousProjectFiles?: readonly ProjectLayerProjectFile[];
}): ProjectFileInstallResult => {
  const records: ProjectLayerProjectFile[] = [];
  const created: string[] = [];
  const refreshed: string[] = [];
  const preserved: string[] = [];
  const previousByPath = new Map((params.previousProjectFiles ?? []).map((file) => [file.path, file]));

  for (const spec of params.specs) {
    const absolutePath = resolveProjectLayerFilePath(params.basePath, spec.path);
    const previous = previousByPath.get(spec.path);

    if (!existsSync(absolutePath)) {
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, spec.content + '\n', 'utf-8');
      created.push(spec.path);
      records.push({
        path: spec.path,
        templateHash: spec.contentHash,
        created: true,
      });
      continue;
    }

    const existingContent = readFileSync(absolutePath, 'utf-8').trimEnd();
    const existingHash = computeHash([existingContent]);

    if (previous?.created === true && existingHash === previous.templateHash) {
      if (existingHash !== spec.contentHash) {
        writeFileSync(absolutePath, spec.content + '\n', 'utf-8');
        refreshed.push(spec.path);
      } else {
        preserved.push(spec.path);
      }

      records.push({
        path: spec.path,
        templateHash: spec.contentHash,
        created: true,
      });
      continue;
    }

    preserved.push(spec.path);
    records.push({
      path: spec.path,
      templateHash: previous?.templateHash ?? spec.contentHash,
      created: previous?.created ?? false,
    });
  }

  return { records, created, refreshed, preserved };
};

const buildContextIndexFromDisk = (params: {
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

const computeProjectFileHash = (basePath: string, relativePath: string): string =>
  computeHash([readFileSync(resolveProjectLayerFilePath(basePath, relativePath), 'utf-8').trimEnd()]);

const collectDocumentPathsFromManifest = (manifest: ProjectLayerManifest): string[] =>
  [
    ...manifest.managed_files.map((file) => file.path),
    ...manifest.project_files.map((file) => file.path),
    ...manifest.packs.flatMap((pack) => pack.documents.map((file) => file.path)),
  ].sort();

const buildDocsStatusRowsFromDisk = (params: {
  basePath: string;
  documentPaths: readonly string[];
}): string[] =>
  params.documentPaths.map((path) => {
    const document = parseProjectLayerDocument(path, readFileSync(resolveProjectLayerFilePath(params.basePath, path), 'utf-8'));
    return `| ${document.path} | ${document.status} | ${document.owner} |`;
  });

const replaceDocsStatusRows = (content: string, rows: readonly string[]): string => {
  const lines = content.trimEnd().split('\n');
  const tableBounds = findDocsStatusTableBounds(lines);

  if (tableBounds === null) {
    throw new Error('docs/docs-status.md table header not found');
  }

  return (
    [...lines.slice(0, tableBounds.dividerIndex + 1), ...rows, ...lines.slice(tableBounds.tableEndIndex)].join('\n') +
    '\n'
  );
};

const updateDocsStatusTable = (basePath: string, documentPaths: readonly string[]): { beforeHash: string; afterHash: string } => {
  const docsStatusPath = 'docs/docs-status.md';
  const absolutePath = resolveProjectLayerFilePath(basePath, docsStatusPath);
  const beforeHash = computeProjectFileHash(basePath, docsStatusPath);
  const rows = buildDocsStatusRowsFromDisk({ basePath, documentPaths });
  const nextContent = replaceDocsStatusRows(readFileSync(absolutePath, 'utf-8'), rows);
  writeFileSync(absolutePath, nextContent, 'utf-8');

  return {
    beforeHash,
    afterHash: computeProjectFileHash(basePath, docsStatusPath),
  };
};

const updateDocsStatusProjectFileRecord = (params: {
  manifest: ProjectLayerManifest;
  beforeHash: string;
  afterHash: string;
}): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse({
    ...params.manifest,
    project_files: params.manifest.project_files.map((file) => {
      if (file.path !== 'docs/docs-status.md' || !file.created || file.templateHash !== params.beforeHash) {
        return file;
      }

      return {
        ...file,
        templateHash: params.afterHash,
      };
    }),
  });

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

const buildProjectLayerManifest = (params: {
  tools: readonly ProjectLayerTool[];
  managedFiles: readonly string[];
  projectFiles: readonly ProjectLayerProjectFile[];
  packs: readonly ProjectLayerPackRecord[];
  sourceHash: string;
  cliVersion: string;
  generatedAt: string;
  settings?: Record<string, unknown>;
}): ProjectLayerManifest =>
  ProjectLayerManifestSchema.parse({
    schemaVersion: 1,
    kind: 'project-operating-layer',
    tools: [...params.tools],
    managed_files: params.managedFiles.map((path) => ({
      path,
      sourceHash: params.sourceHash,
    })),
    project_files: [...params.projectFiles],
    packs: [...params.packs],
    settings: params.settings ?? {},
    sourceHash: params.sourceHash,
    cliVersion: params.cliVersion,
    generatedAt: params.generatedAt,
  });

const retireUnselectedManagedFiles = (params: {
  basePath: string;
  previousManifest: ProjectLayerManifest | null;
  nextManagedPaths: readonly string[];
}): void => {
  if (!params.previousManifest) return;

  const nextManagedPathSet = new Set(params.nextManagedPaths);
  for (const file of params.previousManifest.managed_files) {
    if (!nextManagedPathSet.has(file.path)) {
      removeManagedProjectFile(params.basePath, file.path);
    }
  }
};

export const installProjectLayer = (params: {
  basePath: string;
  tools: readonly ProjectLayerTool[];
  previousManifest?: ProjectLayerManifest | null;
}): ProjectLayerInstallResult => {
  const previousManifest =
    params.previousManifest === undefined ? readProjectLayerManifest(params.basePath) : params.previousManifest;
  const specs = loadProjectLayerTemplateSpecs(params.tools);
  const sourceHash = computeProjectLayerSourceHash(specs);
  const generatedAt = new Date().toISOString();
  const managedSpecs = specs.filter((spec) => spec.ownership === 'managed');
  const projectSpecs = specs.filter((spec) => spec.ownership === 'project');
  const managedPaths = managedSpecs.map((spec) => spec.path);
  retireUnselectedManagedFiles({
    basePath: params.basePath,
    previousManifest,
    nextManagedPaths: managedPaths,
  });
  const managedResult = installManagedFiles(params.basePath, managedSpecs, { sourceHash, generatedAt });
  const projectResult = installProjectFiles({
    basePath: params.basePath,
    specs: projectSpecs,
    previousProjectFiles: previousManifest?.project_files,
  });
  const provisionalManifest = buildProjectLayerManifest({
    tools: params.tools,
    managedFiles: managedPaths,
    projectFiles: projectResult.records,
    packs: previousManifest?.packs ?? [],
    sourceHash,
    cliVersion: getCliVersion(),
    generatedAt,
    settings: previousManifest?.settings,
  });
  const { manifest, contextIndex } = refreshProjectLayerDerivedState({
    basePath: params.basePath,
    manifest: provisionalManifest,
    generatedAt,
  });

  writeProjectLayerManifest(params.basePath, manifest);

  return {
    manifest,
    contextIndex,
    written: managedResult.written,
    appended: managedResult.appended,
    createdProjectFiles: projectResult.created,
    refreshedProjectFiles: projectResult.refreshed,
    preservedProjectFiles: projectResult.preserved,
  };
};

export const updateProjectLayer = (params: {
  basePath: string;
  manifest: ProjectLayerManifest;
}): ProjectLayerInstallResult => {
  const specs = loadProjectLayerTemplateSpecs(params.manifest.tools);
  const sourceHash = computeProjectLayerSourceHash(specs);
  const generatedAt = new Date().toISOString();
  const managedSpecs = specs.filter((spec) => spec.ownership === 'managed');
  const projectSpecs = specs.filter((spec) => spec.ownership === 'project');
  const managedResult = installManagedFiles(params.basePath, managedSpecs, { sourceHash, generatedAt });
  const projectResult = installProjectFiles({
    basePath: params.basePath,
    specs: projectSpecs,
    previousProjectFiles: params.manifest.project_files,
  });
  const provisionalManifest = buildProjectLayerManifest({
    tools: params.manifest.tools,
    managedFiles: managedSpecs.map((spec) => spec.path),
    projectFiles: projectResult.records,
    packs: params.manifest.packs,
    sourceHash,
    cliVersion: getCliVersion(),
    generatedAt,
    settings: params.manifest.settings,
  });
  const { manifest, contextIndex } = refreshProjectLayerDerivedState({
    basePath: params.basePath,
    manifest: provisionalManifest,
    generatedAt,
  });

  writeProjectLayerManifest(params.basePath, manifest);

  return {
    manifest,
    contextIndex,
    written: managedResult.written,
    appended: managedResult.appended,
    createdProjectFiles: projectResult.created,
    refreshedProjectFiles: projectResult.refreshed,
    preservedProjectFiles: projectResult.preserved,
  };
};

// ----- diff and audit -----

const issue = (level: ProjectLayerIssueLevel, code: string, message: string): ProjectLayerIssue => ({
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

const compareContextDocument = (params: {
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

const compareDocsStatusEntry = (params: {
  expected: ProjectLayerDocumentReadResult;
  entry: DocsStatusEntry | undefined;
}): ProjectLayerIssue[] => {
  const entry = params.entry;
  if (entry === undefined) {
    return [issue('error', 'docs-status-missing-document', `docs-status 누락: ${params.expected.path}`)];
  }

  const issues: ProjectLayerIssue[] = [];
  if (entry.status !== params.expected.status) {
    issues.push(issue('error', 'docs-status-mismatch', `${params.expected.path} docs-status status 불일치`));
  }

  if (entry.owner !== params.expected.owner) {
    issues.push(issue('error', 'docs-status-mismatch', `${params.expected.path} docs-status owner 불일치`));
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

// ----- uninstall -----

function removeManagedProjectFile(basePath: string, relativePath: string): ProjectLayerRemoveResult {
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
