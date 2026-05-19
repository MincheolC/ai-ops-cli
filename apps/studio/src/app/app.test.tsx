import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { useStudioShellStore } from '@/stores/studio-shell-store';
import {
  STUDIO_SNAPSHOT_KIND,
  STUDIO_SNAPSHOT_SCHEMA_VERSION,
  type StudioSnapshotEnvelope,
} from '@/studio-bridge/studio-snapshot';

const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const agentDocument = {
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
  content: [
    '# Agent Operating Layer',
    '',
    '| Field | Value |',
    '| --- | --- |',
    '| Owner | ai-ops |',
    '',
    '```bash',
    'npm run test',
    '```',
    '',
    '<strong>raw html</strong>',
  ].join('\n'),
  trustWarning: null,
  readError: null,
} as const;

const workflowDocument = {
  path: 'docs/agent/workflow.md',
  status: 'Active',
  layer: 'agent',
  owner: 'ai-ops',
  read_when: ['before_task'],
  update_when: ['workflow_changes'],
  indexedContentHash: 'bbbbbb',
  currentContentHash: 'bbbbbb',
  contentHashMatches: true,
  provenance: 'ai-ops-managed',
  content: '# Workflow',
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
  indexedContentHash: 'cccccc',
  currentContentHash: 'dddddd',
  contentHashMatches: false,
  provenance: 'project-owned',
  content: '# Codebase Map',
  trustWarning: 'Reserved document is not current decision-making evidence.',
  readError: null,
} as const;

const snapshot = {
  kind: STUDIO_SNAPSHOT_KIND,
  schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
  generatedAt: '2026-05-19T00:00:00.000Z',
  cliVersion: '1.3.1',
  project: {
    root: '/Users/charles/ai-projects/ai-ops-cli',
    state: 'ready',
    files: {
      manifest: { path: '.ai-ops/manifest.json', exists: true, parsed: true, generatedAt: null, error: null },
      contextIndex: { path: '.ai-ops/context-layer.json', exists: true, parsed: true, generatedAt: null, error: null },
      docsStatus: { path: 'docs/docs-status.md', exists: true, parsed: true, generatedAt: null, error: null },
    },
    audit: {
      currentSourceHash: '388c18',
      hasErrors: false,
      hasWarnings: true,
      issues: [
        {
          level: 'warning',
          code: 'docs-status-mismatch',
          message: 'docs/agent/workflow.md docs-status owner mismatch',
          source: 'docs-status',
          affectedPath: 'docs/agent/workflow.md',
          suggestedActionLabel: 'Review docs status',
        },
      ],
    },
    documents: [agentDocument, workflowDocument, reservedDocument],
    repoWideFiles: [{ path: 'package.json' }],
  },
  runtime: {
    available: true,
    integrations: [{ id: 'context-promotion' }],
    hooks: [{ id: 'context-promotion-review' }],
    skills: [{ id: 'skill-load-check' }, { id: 'doc-impact-reviewer' }],
    subagents: [{ id: 'security-gate' }],
  },
} as const satisfies StudioSnapshotEnvelope;

const uninitializedSnapshot = {
  ...snapshot,
  project: {
    ...snapshot.project,
    state: 'uninitialized',
  },
} as const satisfies StudioSnapshotEnvelope;

const cleanAuditSnapshot = {
  ...snapshot,
  project: {
    ...snapshot.project,
    audit: {
      currentSourceHash: '388c18',
      hasErrors: false,
      hasWarnings: false,
      issues: [],
    },
  },
} as const satisfies StudioSnapshotEnvelope;

const auditSnapshot = {
  ...snapshot,
  project: {
    ...snapshot.project,
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
          code: 'docs-status-mismatch',
          message: 'docs/agent/workflow.md docs-status owner mismatch',
          source: 'docs-status',
          affectedPath: 'docs/agent/workflow.md',
          suggestedActionLabel: 'Review docs status',
        },
      ],
    },
  },
} as const satisfies StudioSnapshotEnvelope;

const manifestAuditSnapshot = {
  ...snapshot,
  project: {
    ...snapshot.project,
    audit: {
      currentSourceHash: null,
      hasErrors: true,
      hasWarnings: false,
      issues: [
        {
          level: 'error',
          code: 'missing-manifest',
          message: '.ai-ops/manifest.json is missing',
          source: 'manifest',
          affectedPath: '.ai-ops/manifest.json',
          suggestedActionLabel: 'Review manifest record',
        },
      ],
    },
  },
} as const satisfies StudioSnapshotEnvelope;

describe('App shell', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useStudioShellStore.setState({
      selectedView: 'overview',
      selectedDocumentPath: null,
      selectedAuditIssueId: null,
      sidebarCollapsed: false,
    });
  });

  it('renders project overview summary from a mocked snapshot', async () => {
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    expect(await screen.findAllByText('/Users/charles/ai-projects/ai-ops-cli')).toHaveLength(2);
    expect(screen.getByTestId('project-state')).toHaveTextContent('ready');
    expect(screen.getByTestId('document-count')).toHaveTextContent('3');
    expect(screen.getByTestId('audit-state')).toHaveTextContent('warnings');
    expect(screen.getByTestId('source-hash')).toHaveTextContent('388c18');
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();
  });

  it('renders context graph grouping and opens graph rows in Documents', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Context Graph/ }));

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Reserved')).toBeInTheDocument();
    expect(screen.getAllByText('agent').length).toBeGreaterThan(0);
    expect(screen.getByText('project')).toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /docs\/agent\/maps\/codebase-map\.md/ }));

    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByText('project-owned')).toBeInTheDocument();
    expect(screen.getByText('Hash mismatch')).toBeInTheDocument();
    expect(screen.getByTestId('inspector-warnings')).toHaveTextContent(
      'Reserved document is not current decision-making evidence.',
    );
  });

  it('renders read-only Markdown preview with GFM and without raw HTML', async () => {
    const user = userEvent.setup();
    const { container } = render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Documents/ }));

    expect(screen.getByRole('heading', { name: 'Agent Operating Layer', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('npm run test')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });

  it('shows Reserved trust and hash warnings in the document list and Inspector', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Documents/ }));
    await user.click(screen.getByRole('button', { name: /docs\/agent\/maps\/codebase-map\.md/ }));

    expect(screen.getByTestId('inspector-warnings')).toHaveTextContent(
      'Current content hash differs from the indexed content hash.',
    );
    expect(screen.getByText('codebase_map_needed')).toBeInTheDocument();
    expect(screen.getByText('codebase_map_changes')).toBeInTheDocument();
  });

  it('shows empty project views for uninitialized snapshots', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => uninitializedSnapshot} />);

    await user.click(await screen.findByRole('button', { name: /Documents/ }));

    expect(screen.getByText('Uninitialized project')).toBeInTheDocument();
    expect(screen.getByText('No context-layer documents')).toBeInTheDocument();
    expect(screen.getByText('Snapshot document set is empty.')).toBeInTheDocument();
  });

  it('renders a clear Audit state from snapshot audit issues', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => cleanAuditSnapshot} />);

    await user.click(await screen.findByRole('button', { name: /Audit/ }));

    expect(screen.getByRole('heading', { name: 'Audit clear', level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('audit-errors')).toHaveTextContent('0');
    expect(screen.getByTestId('audit-warnings')).toHaveTextContent('0');
  });

  it('groups Audit diagnostics and opens selected document-linked issues', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => auditSnapshot} />);

    await user.click(await screen.findByRole('button', { name: /Audit/ }));

    expect(screen.getByTestId('audit-errors')).toHaveTextContent('1');
    expect(screen.getByTestId('audit-warnings')).toHaveTextContent('1');
    expect(screen.getByTestId('audit-affected-paths')).toHaveTextContent('2');
    expect(screen.getByTestId('audit-issue-sources')).toHaveTextContent('2');
    expect(screen.getAllByText('missing-file').length).toBeGreaterThan(0);
    expect(screen.getAllByText('docs-status-mismatch').length).toBeGreaterThan(0);
    expect(screen.getAllByText('file-system').length).toBeGreaterThan(0);
    expect(screen.getAllByText('docs-status').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /docs-status-mismatch/ }));

    expect(screen.getByText('Review docs status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review docs status/ })).not.toBeInTheDocument();

    await user.click(screen.getByTestId('open-audit-document'));

    expect(screen.getByText('Inspector')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workflow', level: 1 })).toBeInTheDocument();
  });

  it('does not show document navigation for non-document Audit issues', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => manifestAuditSnapshot} />);

    await user.click(await screen.findByRole('button', { name: /Audit/ }));

    expect(screen.getAllByText('missing-manifest').length).toBeGreaterThan(0);
    expect(screen.getByText('Review manifest record')).toBeInTheDocument();
    expect(screen.queryByTestId('open-audit-document')).not.toBeInTheDocument();
  });

  it('renders string Tauri command failures without replacing the message', async () => {
    render(
      <App
        queryClient={createTestQueryClient()}
        snapshotLoader={async () => {
          throw 'CLI build missing: /workspace/apps/cli/dist/bin/index.js';
        }}
      />,
    );

    expect(await screen.findByText('CLI build missing')).toBeInTheDocument();
    expect(screen.getByText('CLI build missing: /workspace/apps/cli/dist/bin/index.js')).toBeInTheDocument();
  });
});
