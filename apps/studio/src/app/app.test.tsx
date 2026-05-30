import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { DEFAULT_STUDIO_APPEARANCE, useStudioAppearanceStore } from '@/stores/studio-appearance-store';
import { useStudioShellStore } from '@/stores/studio-shell-store';
import {
  STUDIO_SNAPSHOT_KIND,
  STUDIO_SNAPSHOT_SCHEMA_VERSION,
  type StudioSnapshotEnvelope,
} from '@/studio-bridge/studio-snapshot';
import { studioThemePresets } from '@/theme/theme-preset-registry';

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
    unavailableReason: null,
    userBasePath: '/Users/charles/.ai-ops',
    codexHomePath: '/Users/charles/.codex',
    manifests: {
      integrations: {
        path: '/Users/charles/.ai-ops/integrations-manifest.json',
        exists: true,
        parsed: true,
        generatedAt: '2026-05-19T00:00:00.000Z',
        error: null,
      },
      skills: {
        path: '/Users/charles/.ai-ops/skills-manifest.json',
        exists: true,
        parsed: true,
        generatedAt: '2026-05-19T00:00:00.000Z',
        error: null,
      },
      subagents: {
        path: '/Users/charles/.ai-ops/subagents-manifest.json',
        exists: true,
        parsed: true,
        generatedAt: '2026-05-19T00:00:00.000Z',
        error: null,
      },
      hooks: {
        path: '/Users/charles/.codex/hooks.json',
        exists: true,
        parsed: true,
        generatedAt: null,
        error: null,
      },
    },
    integrations: [
      {
        id: 'pc',
        description: 'Codex git-commit 후 $pc:done handoff를 요구하는 personal context integration',
        installed: true,
        installedAt: '2026-05-18T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
        components: [
          {
            type: 'skill',
            id: 'pc',
            installed: true,
            owned: true,
            catalog: {
              type: 'skill',
              id: 'pc',
              tools: ['codex'],
            },
            installedComponent: {
              type: 'skill',
              id: 'pc',
              tools: ['codex'],
              owned: true,
            },
          },
          {
            type: 'codex-hook',
            id: 'pc',
            installed: true,
            owned: false,
            catalog: {
              type: 'codex-hook',
              id: 'pc',
            },
            installedComponent: {
              type: 'codex-hook',
              id: 'pc',
              command: 'ai-ops integration hook post-tool-use --workflows pc',
              owned: false,
            },
          },
          {
            type: 'receipt-config',
            id: 'personal-project-contexts',
            installed: true,
            owned: true,
            catalog: {
              type: 'receipt-config',
              id: 'personal-project-contexts',
              storage_path: '~/.personal-project-contexts',
            },
            installedComponent: {
              type: 'receipt-config',
              id: 'personal-project-contexts',
              storagePath: '/Users/charles/.personal-project-contexts',
              owned: true,
            },
          },
        ],
      },
    ],
    hooks: [
      {
        id: 'pc',
        statusMessage: 'pc hook active',
        hooksPath: '/Users/charles/.codex/hooks.json',
        installed: true,
        error: null,
      },
    ],
    skills: [
      {
        id: 'typescript-language',
        kind: 'reference',
        description: 'TypeScript language rules',
        supported_tools: ['codex', 'claude-code'],
        groups: ['language'],
        installed: true,
        installedTools: ['codex'],
        installedPaths: [{ path: 'skills/typescript-language/SKILL.md', exists: true }],
        sourceHash: 'abc123',
      },
      {
        id: 'ai-ops-project-owned-docs',
        kind: 'task',
        description: 'Route operating-layer notes into project-owned docs',
        supported_tools: ['codex'],
        groups: ['agent'],
        installed: false,
        installedTools: [],
        installedPaths: [],
        sourceHash: null,
      },
    ],
    subagents: [
      {
        id: 'security-gate',
        description: 'Decide whether deeper security review is needed',
        supported_tools: ['codex'],
        installed: true,
        installedTools: ['codex'],
        installedPaths: [
          { path: 'subagents/security-gate.md', exists: true },
          { path: 'subagents/security-gate.toml', exists: false },
        ],
        sourceHash: 'def456',
      },
    ],
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
    window.localStorage.clear();
    useStudioShellStore.setState({
      selectedView: 'overview',
      selectedDocumentPath: null,
      selectedAuditIssueId: null,
      selectedRuntimeItemId: null,
      sidebarCollapsed: false,
    });
    useStudioAppearanceStore.setState(DEFAULT_STUDIO_APPEARANCE);
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

  it('keeps the full v1 navigation graph-scoped, separated, and read-only', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    expect(await screen.findByText('Project read surface / overview')).toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Context Graph/ }));
    expect(screen.getByText('Project read surface / context-graph')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AGENTS\.md/ })).toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Documents/ }));
    expect(screen.getByText('Project read surface / documents')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Agent Operating Layer', level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('package.json')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Audit/ }));
    expect(screen.getByText('Project read surface / audit')).toBeInTheDocument();
    expect(screen.getByText('Diagnostics')).toBeInTheDocument();

    for (const view of ['Integrations', 'Skills', 'Subagents', 'Hooks']) {
      await user.click(screen.getByRole('button', { name: new RegExp(view) }));
      expect(screen.getByText(new RegExp(`Runtime read surface / ${view.toLowerCase()}`))).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Install$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Update$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Uninstall$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /Appearance/ }));
    expect(screen.getByText('Settings / appearance')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Theme preset', level: 2 })).toBeInTheDocument();
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

  it('renders Integrations as a Runtime area with read-only component health', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Integrations/ }));

    expect(screen.getByText('Runtime read surface / integrations')).toBeInTheDocument();
    expect(screen.getByText('Integrations manifest')).toBeInTheDocument();
    expect(screen.getAllByText('pc').length).toBeGreaterThan(0);
    expect(screen.getByText('pre-existing')).toBeInTheDocument();
    expect(screen.getByText('~/.personal-project-contexts')).toBeInTheDocument();
    expect(screen.getByText('/Users/charles/.personal-project-contexts')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Install$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Update$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Uninstall$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
  });

  it('renders Skills and Subagents as Runtime assets instead of project documents', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Skills/ }));

    expect(screen.getByText('Runtime read surface / skills')).toBeInTheDocument();
    expect(screen.getByText('reference skills')).toBeInTheDocument();
    expect(screen.getByText('task skills')).toBeInTheDocument();
    expect(screen.getAllByText('typescript-language').length).toBeGreaterThan(0);
    expect(screen.getByText('skills/typescript-language/SKILL.md')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Subagents/ }));

    expect(screen.getByText('Runtime read surface / subagents')).toBeInTheDocument();
    expect(screen.getAllByText('security-gate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('subagents/security-gate.toml').length).toBeGreaterThan(0);
    expect(screen.getAllByText('missing').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /AGENTS\.md/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-audit-document')).not.toBeInTheDocument();
  });

  it('renders known Hook installed state with related integrations', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Hooks/ }));

    expect(screen.getByText('Runtime read surface / hooks')).toBeInTheDocument();
    expect(screen.getByText('pc hook active')).toBeInTheDocument();
    expect(screen.getAllByText('pc').length).toBeGreaterThan(0);
  });

  it('opens Appearance as a real settings view with all bundled presets', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Appearance/ }));

    expect(screen.getByRole('heading', { name: 'Theme preset', level: 2 })).toBeInTheDocument();
    expect(screen.getByText(`${studioThemePresets.length} presets`)).toBeInTheDocument();
    for (const preset of studioThemePresets) {
      expect(screen.getAllByText(preset.label).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText('Appearance controls stay in a later phase.')).not.toBeInTheDocument();
  });

  it('updates the top bar theme badge after preset changes', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    expect(await screen.findByTestId('theme-badge')).toHaveTextContent('Cohere / light');

    await user.click(screen.getByRole('button', { name: /Appearance/ }));
    await user.click(screen.getByRole('button', { name: /x\.ai/ }));

    expect(screen.getByTestId('theme-badge')).toHaveTextContent('x.ai / dark');
  });

  it('persists Appearance preferences through localStorage and rerender', async () => {
    const user = userEvent.setup();
    const rendered = render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Appearance/ }));
    await user.click(screen.getByRole('button', { name: /Linear/ }));

    expect(window.localStorage.getItem('ai-ops-studio.appearance.v1')).toContain('linear-app');

    rendered.rerender(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    expect(await screen.findByTestId('theme-badge')).toHaveTextContent('Linear / dark');
  });

  it('does not add runtime mutation controls to Appearance', async () => {
    const user = userEvent.setup();
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    await user.click(await screen.findByRole('button', { name: /Appearance/ }));

    expect(screen.queryByRole('button', { name: /^Install$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Update$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Uninstall$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
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
