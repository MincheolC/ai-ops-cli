import { describe, expect, it } from 'vitest';
import { buildProjectViewModel, selectAuditIssue, selectProjectDocument } from './project-view-model';
import { STUDIO_SNAPSHOT_KIND, STUDIO_SNAPSHOT_SCHEMA_VERSION, type StudioSnapshotEnvelope } from './studio-snapshot';

const createSnapshot = (documents: readonly unknown[]): StudioSnapshotEnvelope => ({
  kind: STUDIO_SNAPSHOT_KIND,
  schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
  generatedAt: '2026-05-19T00:00:00.000Z',
  cliVersion: 'test',
  project: {
    root: '/workspace/project',
    state: 'ready',
    files: {
      manifest: { path: '.ai-ops/manifest.json', exists: true, parsed: true, generatedAt: null, error: null },
      contextIndex: { path: '.ai-ops/context-layer.json', exists: true, parsed: true, generatedAt: null, error: null },
      docsStatus: { path: 'docs/docs-status.md', exists: true, parsed: true, generatedAt: null, error: null },
    },
    audit: {
      currentSourceHash: '388c18',
      hasErrors: false,
      hasWarnings: false,
      issues: [],
    },
    documents,
    repoFiles: [{ path: 'package.json' }],
  },
  runtime: {},
});

const activeDocument = {
  path: 'AGENTS.md',
  status: 'Active',
  layer: 'agent',
  owner: 'ai-ops',
  read_when: ['before_task'],
  update_when: ['operating_layer_changes'],
  indexedContentHash: 'aaaaaa',
  currentContentHash: 'aaaaaa',
  contentHashMatches: true,
  provenance: 'ai-ops-managed',
  content: '# Agent Operating Layer',
  trustWarning: null,
  readError: null,
} as const;

const reservedDocument = {
  path: 'docs/agent/maps/codebase-map.md',
  status: 'Reserved',
  layer: 'agent',
  owner: 'project',
  read_when: ['codebase_map_needed'],
  update_when: ['codebase_map_changes'],
  indexedContentHash: 'bbbbbb',
  currentContentHash: 'cccccc',
  contentHashMatches: false,
  provenance: 'project-owned',
  content: '# Codebase Map',
  trustWarning: 'Reserved document is not current decision-making evidence.',
  readError: null,
} as const;

describe('project view model', () => {
  it('uses snapshot.project.documents as the only document source', () => {
    const viewModel = buildProjectViewModel(
      createSnapshot([activeDocument, { ...activeDocument, path: '' }, reservedDocument]),
    );

    expect(viewModel.documents.map((document) => document.path)).toEqual([
      'AGENTS.md',
      'docs/agent/maps/codebase-map.md',
    ]);
    expect(viewModel.documents.map((document) => document.path)).not.toContain('package.json');
  });

  it('groups documents by status, layer, owner, and path', () => {
    const viewModel = buildProjectViewModel(createSnapshot([reservedDocument, activeDocument]));

    expect(viewModel.counts.byStatus).toEqual([
      { label: 'Active', count: 1 },
      { label: 'Draft', count: 0 },
      { label: 'Reserved', count: 1 },
      { label: 'Archived', count: 0 },
    ]);
    expect(viewModel.graph.find((group) => group.status === 'Active')?.layers[0]?.owners[0]?.documents[0]?.path).toBe(
      'AGENTS.md',
    );
    expect(viewModel.graph.find((group) => group.status === 'Reserved')?.layers[0]?.owners[0]?.owner).toBe('project');
  });

  it('selects the requested document or falls back to the first Active document', () => {
    const documents = buildProjectViewModel(createSnapshot([reservedDocument, activeDocument])).documents;

    expect(selectProjectDocument(documents, 'docs/agent/maps/codebase-map.md')?.path).toBe(
      'docs/agent/maps/codebase-map.md',
    );
    expect(selectProjectDocument(documents, null)?.path).toBe('AGENTS.md');
  });

  it('parses audit issue metadata and groups by severity, code, source, and affected path', () => {
    const viewModel = buildProjectViewModel({
      ...createSnapshot([activeDocument]),
      project: {
        ...createSnapshot([activeDocument]).project,
        audit: {
          currentSourceHash: '388c18',
          hasErrors: true,
          hasWarnings: true,
          issues: [
            {
              level: 'error',
              code: 'missing-file',
              message: 'File missing: AGENTS.md',
              source: 'file-system',
              affectedPath: 'AGENTS.md',
              suggestedActionLabel: 'Review missing file',
            },
            {
              level: 'warning',
              code: 'missing-file',
              message: 'File missing again: AGENTS.md',
              source: 'file-system',
              affectedPath: 'AGENTS.md',
              suggestedActionLabel: 'Review missing file',
            },
            {
              level: 'warning',
              code: 'custom-code',
              message: 'Legacy issue shape',
            },
          ],
        },
      },
    });

    expect(viewModel.audit.summary).toEqual({
      errors: 1,
      warnings: 2,
      affectedPaths: 1,
      issueSources: 2,
    });
    expect(viewModel.audit.issues[0]).toMatchObject({
      id: '0:error:missing-file:file-system:AGENTS.md',
      source: 'file-system',
      affectedPath: 'AGENTS.md',
      suggestedActionLabel: 'Review missing file',
    });
    expect(viewModel.audit.issues[2]).toMatchObject({
      source: 'unknown',
      affectedPath: null,
      suggestedActionLabel: null,
    });
    expect(viewModel.audit.groups.map((group) => group.id)).toEqual([
      'error:missing-file:file-system:AGENTS.md',
      'warning:custom-code:unknown:none',
      'warning:missing-file:file-system:AGENTS.md',
    ]);
    expect(selectAuditIssue(viewModel.audit.issues, null)?.id).toBe('0:error:missing-file:file-system:AGENTS.md');
  });
});
