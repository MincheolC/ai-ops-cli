import { readFileSync, writeFileSync } from 'node:fs';
import type { ProjectLayerManifest } from '@/core/schemas/index.js';
import { ProjectLayerManifestSchema } from '@/core/schemas/index.js';
import { computeHash } from '@/shared/source-hash.js';
import { parseProjectLayerDocument } from './document.logic.js';
import { resolveProjectLayerFilePath } from './path.util.js';
import type { DocsStatusEntry, DocsStatusTableBounds, ProjectLayerDocumentReadResult, ProjectLayerIssue } from './types.js';

const docsStatusIssue = (code: string, message: string): ProjectLayerIssue => ({
  level: 'error',
  code,
  message,
});

const computeDocsStatusFileHash = (basePath: string, relativePath: string): string =>
  computeHash([readFileSync(resolveProjectLayerFilePath(basePath, relativePath), 'utf-8').trimEnd()]);

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

export const findDocsStatusTableBounds = (lines: readonly string[]): DocsStatusTableBounds | null => {
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

export const parseDocsStatusEntries = (content: string): DocsStatusEntry[] => {
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

export const buildDocsStatusRowsFromDisk = (params: {
  basePath: string;
  documentPaths: readonly string[];
}): string[] =>
  params.documentPaths.map((path) => {
    const document = parseProjectLayerDocument(path, readFileSync(resolveProjectLayerFilePath(params.basePath, path), 'utf-8'));
    return `| ${document.path} | ${document.status} | ${document.owner} |`;
  });

export const replaceDocsStatusRows = (content: string, rows: readonly string[]): string => {
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

export const updateDocsStatusTable = (basePath: string, documentPaths: readonly string[]): { beforeHash: string; afterHash: string } => {
  const docsStatusPath = 'docs/docs-status.md';
  const absolutePath = resolveProjectLayerFilePath(basePath, docsStatusPath);
  const beforeHash = computeDocsStatusFileHash(basePath, docsStatusPath);
  const rows = buildDocsStatusRowsFromDisk({ basePath, documentPaths });
  const nextContent = replaceDocsStatusRows(readFileSync(absolutePath, 'utf-8'), rows);
  writeFileSync(absolutePath, nextContent, 'utf-8');

  return {
    beforeHash,
    afterHash: computeDocsStatusFileHash(basePath, docsStatusPath),
  };
};

export const updateDocsStatusProjectFileRecord = (params: {
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

export const compareDocsStatusEntry = (params: {
  expected: ProjectLayerDocumentReadResult;
  entry: DocsStatusEntry | undefined;
}): ProjectLayerIssue[] => {
  const entry = params.entry;
  if (entry === undefined) {
    return [docsStatusIssue('docs-status-missing-document', `docs-status 누락: ${params.expected.path}`)];
  }

  const issues: ProjectLayerIssue[] = [];
  if (entry.status !== params.expected.status) {
    issues.push(docsStatusIssue('docs-status-mismatch', `${params.expected.path} docs-status status 불일치`));
  }

  if (entry.owner !== params.expected.owner) {
    issues.push(docsStatusIssue('docs-status-mismatch', `${params.expected.path} docs-status owner 불일치`));
  }

  return issues;
};
