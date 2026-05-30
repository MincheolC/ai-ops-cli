import { describe, expect, it } from 'vitest';
import { buildRuntimeViewModel, selectRuntimeItem } from './runtime-view-model';
import { STUDIO_SNAPSHOT_KIND, STUDIO_SNAPSHOT_SCHEMA_VERSION, type StudioSnapshotEnvelope } from './studio-snapshot';

const createSnapshot = (runtime: Record<string, unknown>): StudioSnapshotEnvelope => ({
  kind: STUDIO_SNAPSHOT_KIND,
  schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
  generatedAt: '2026-05-19T00:00:00.000Z',
  cliVersion: 'test',
  project: {
    root: '/workspace/project',
  },
  runtime,
});

const runtime = {
  available: true,
  unavailableReason: null,
  userBasePath: '/Users/test/.ai-ops',
  codexHomePath: '/Users/test/.codex',
  manifests: {
    integrations: {
      path: '/Users/test/.ai-ops/integrations-manifest.json',
      exists: true,
      parsed: true,
      generatedAt: '2026-05-19T00:00:00.000Z',
      error: null,
    },
    skills: {
      path: '/Users/test/.ai-ops/skills-manifest.json',
      exists: true,
      parsed: true,
      generatedAt: '2026-05-19T00:00:00.000Z',
      error: null,
    },
    subagents: {
      path: '/Users/test/.ai-ops/subagents-manifest.json',
      exists: true,
      parsed: true,
      generatedAt: '2026-05-19T00:00:00.000Z',
      error: null,
    },
    hooks: {
      path: '/Users/test/.codex/hooks.json',
      exists: true,
      parsed: true,
      generatedAt: null,
      error: null,
    },
  },
  integrations: [
    {
      id: 'pc',
      description: 'Personal context integration',
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
            storagePath: '/Users/test/.personal-project-contexts',
            owned: true,
          },
        },
      ],
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
  hooks: [
    {
      id: 'pc',
      statusMessage: 'pc hook active',
      hooksPath: '/Users/test/.codex/hooks.json',
      installed: true,
      error: null,
    },
  ],
} as const;

describe('runtime view model', () => {
  it('normalizes installed and not installed integrations with component health', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));

    expect(viewModel.counts.integrations).toEqual({ installed: 1, total: 1 });
    expect(viewModel.integrations.map((integration) => [integration.id, integration.installed])).toEqual([
      ['pc', true],
    ]);
    expect(viewModel.integrations[0]?.components.map((component) => component.ownership)).toEqual([
      'owned',
      'pre-existing',
      'owned',
    ]);
  });

  it('keeps receipt config catalog and installed storage paths separate', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));
    const receiptConfig = viewModel.integrations[0]?.components.find(
      (component) => component.type === 'receipt-config',
    );

    expect(receiptConfig).toMatchObject({
      catalogStoragePath: '~/.personal-project-contexts',
      installedStoragePath: '/Users/test/.personal-project-contexts',
    });
  });

  it('groups skills by reference and task kind', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));

    expect(viewModel.skillGroups).toEqual([
      {
        kind: 'reference',
        skills: [viewModel.skills[0]],
        installed: 1,
        total: 1,
      },
      {
        kind: 'task',
        skills: [viewModel.skills[1]],
        installed: 0,
        total: 1,
      },
    ]);
    expect(viewModel.skills[0]).toMatchObject({
      id: 'typescript-language',
      supportedTools: ['codex', 'claude-code'],
      groups: ['language'],
      installedTools: ['codex'],
      sourceHash: 'abc123',
    });
  });

  it('normalizes subagent installed path existence and missing path summary', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));

    expect(viewModel.subagents[0]).toMatchObject({
      id: 'security-gate',
      installed: true,
      sourceHash: 'def456',
    });
    expect(viewModel.subagents[0]?.installedPaths).toEqual([
      { path: 'subagents/security-gate.md', exists: true },
      { path: 'subagents/security-gate.toml', exists: false },
    ]);
    expect(viewModel.missingInstalledPaths).toEqual([
      { kind: 'subagent', id: 'security-gate', path: 'subagents/security-gate.toml' },
    ]);
  });

  it('matches hooks to related integration codex-hook components', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));

    expect(viewModel.hooks[0]).toMatchObject({
      id: 'pc',
      installed: true,
      relatedIntegrationIds: ['pc'],
    });
  });

  it('keeps catalog arrays when runtime homes are unavailable', () => {
    const viewModel = buildRuntimeViewModel(
      createSnapshot({
        ...runtime,
        available: false,
        unavailableReason: 'AI_OPS_HOME or HOME is required for user/global runtime manifests.',
        userBasePath: null,
        codexHomePath: null,
        manifests: {
          integrations: {
            path: '.ai-ops/integrations-manifest.json',
            exists: false,
            parsed: false,
            generatedAt: null,
            error: 'AI_OPS_HOME or HOME is required for user/global runtime manifests.',
          },
          skills: {
            path: '.ai-ops/skills-manifest.json',
            exists: false,
            parsed: false,
            generatedAt: null,
            error: 'AI_OPS_HOME or HOME is required for user/global runtime manifests.',
          },
          subagents: {
            path: '.ai-ops/subagents-manifest.json',
            exists: false,
            parsed: false,
            generatedAt: null,
            error: 'AI_OPS_HOME or HOME is required for user/global runtime manifests.',
          },
          hooks: {
            path: '.codex/hooks.json',
            exists: false,
            parsed: false,
            generatedAt: null,
            error: 'CODEX_HOME or HOME is required for Codex hooks.',
          },
        },
      }),
    );

    expect(viewModel.available).toBe(false);
    expect(viewModel.integrations.map((integration) => integration.id)).toEqual(['pc']);
    expect(viewModel.skills.map((skill) => skill.id)).toEqual(['typescript-language', 'ai-ops-project-owned-docs']);
    expect(viewModel.subagents.map((subagent) => subagent.id)).toEqual(['security-gate']);
    expect(viewModel.manifestStates.map((state) => state.state)).toEqual([
      'unavailable',
      'unavailable',
      'unavailable',
      'unavailable',
    ]);
  });

  it('selects requested runtime item or falls back to an installed item', () => {
    const viewModel = buildRuntimeViewModel(createSnapshot(runtime));

    expect(selectRuntimeItem(viewModel.integrations, 'pc')?.id).toBe('pc');
    expect(selectRuntimeItem(viewModel.integrations, null)?.id).toBe('pc');
  });
});
