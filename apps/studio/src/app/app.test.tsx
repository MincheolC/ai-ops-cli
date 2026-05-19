import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';
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

const snapshot = {
  kind: STUDIO_SNAPSHOT_KIND,
  schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
  generatedAt: '2026-05-19T00:00:00.000Z',
  cliVersion: '1.3.1',
  project: {
    root: '/Users/charles/ai-projects/ai-ops-cli',
    state: 'ready',
    files: {
      manifest: { exists: true, parsed: true },
      contextIndex: { exists: true, parsed: true },
      docsStatus: { exists: true, parsed: true },
    },
    audit: {
      hasErrors: false,
      hasWarnings: true,
      issues: [{ code: 'reserved-doc' }],
    },
    documents: [{ path: 'AGENTS.md' }, { path: 'docs/agent/workflow.md' }],
  },
  runtime: {
    available: true,
    integrations: [{ id: 'context-promotion' }],
    hooks: [{ id: 'context-promotion-review' }],
    skills: [{ id: 'skill-load-check' }, { id: 'doc-impact-reviewer' }],
    subagents: [{ id: 'security-gate' }],
  },
} as const satisfies StudioSnapshotEnvelope;

describe('App shell', () => {
  it('renders project and runtime summary from a mocked snapshot', async () => {
    render(<App queryClient={createTestQueryClient()} snapshotLoader={async () => snapshot} />);

    expect(await screen.findAllByText('/Users/charles/ai-projects/ai-ops-cli')).toHaveLength(2);
    expect(screen.getByTestId('project-state')).toHaveTextContent('ready');
    expect(screen.getByTestId('document-count')).toHaveTextContent('2');
    expect(screen.getByTestId('audit-state')).toHaveTextContent('warnings');
    expect(screen.getByTestId('runtime-state')).toHaveTextContent('available');
    expect(screen.getByText('2 skills, 1 subagents')).toBeInTheDocument();
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
