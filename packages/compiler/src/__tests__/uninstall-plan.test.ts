import { describe, it, expect } from 'vitest';
import { inferInstalledFiles } from '../uninstall-plan.js';
import type { Manifest } from '../schemas/index.js';

const BASE_MANIFEST: Manifest = {
  tools: [],
  scope: 'project',
  installed_rules: ['typescript', 'react-typescript'],
  sourceHash: 'a1b2c3',
  generatedAt: '2026-01-01T00:00:00.000Z',
};

describe('inferInstalledFiles - claude-code', () => {
  it('비모노: installed_rules → .claude/rules/*.md', () => {
    const manifest: Manifest = { ...BASE_MANIFEST, tools: ['claude-code'] };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.claude/rules/typescript.md');
    expect(files).toContain('.claude/rules/react-typescript.md');
    expect(files).toHaveLength(2);
  });

  it('모노레포: installed_rules → .claude/rules/*.md (workspaces 무관)', () => {
    const manifest: Manifest = {
      ...BASE_MANIFEST,
      tools: ['claude-code'],
      workspaces: {
        'apps/web': { preset: 'frontend-web', rules: ['typescript'] },
        'services/api': { preset: 'backend-ts', rules: ['react-typescript'] },
      },
    };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.claude/rules/typescript.md');
    expect(files).toContain('.claude/rules/react-typescript.md');
    expect(files).toHaveLength(2);
  });
});

describe('inferInstalledFiles - codex', () => {
  it('비모노: .codex/AGENTS.md + .codex/AGENTS.override.md', () => {
    const manifest: Manifest = { ...BASE_MANIFEST, tools: ['codex'] };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.codex/AGENTS.md');
    expect(files).toContain('.codex/AGENTS.override.md');
    expect(files).toHaveLength(2);
  });

  it('모노레포: .codex/AGENTS.md + {workspace}/AGENTS.override.md', () => {
    const manifest: Manifest = {
      ...BASE_MANIFEST,
      tools: ['codex'],
      workspaces: {
        'apps/web': { preset: 'frontend-web', rules: ['typescript'] },
        'services/api': { preset: 'backend-ts', rules: ['react-typescript'] },
      },
    };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.codex/AGENTS.md');
    expect(files).toContain('apps/web/AGENTS.override.md');
    expect(files).toContain('services/api/AGENTS.override.md');
    expect(files).toHaveLength(3);
  });
});

describe('inferInstalledFiles - gemini', () => {
  it('비모노: .gemini/GEMINI.md', () => {
    const manifest: Manifest = { ...BASE_MANIFEST, tools: ['gemini'] };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.gemini/GEMINI.md');
    expect(files).toHaveLength(1);
  });

  it('모노레포: .gemini/GEMINI.md + {workspace}/GEMINI.md', () => {
    const manifest: Manifest = {
      ...BASE_MANIFEST,
      tools: ['gemini'],
      workspaces: {
        'apps/web': { preset: 'frontend-web', rules: ['typescript'] },
        'services/api': { preset: 'backend-ts', rules: ['react-typescript'] },
      },
    };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.gemini/GEMINI.md');
    expect(files).toContain('apps/web/GEMINI.md');
    expect(files).toContain('services/api/GEMINI.md');
    expect(files).toHaveLength(3);
  });
});

describe('inferInstalledFiles - 복합 도구', () => {
  it('claude-code + codex 비모노: 합집합', () => {
    const manifest: Manifest = { ...BASE_MANIFEST, tools: ['claude-code', 'codex'] };
    const files = inferInstalledFiles(manifest);
    expect(files).toContain('.claude/rules/typescript.md');
    expect(files).toContain('.claude/rules/react-typescript.md');
    expect(files).toContain('.codex/AGENTS.md');
    expect(files).toContain('.codex/AGENTS.override.md');
  });

  it('중복 없음 (Set 보장)', () => {
    const manifest: Manifest = { ...BASE_MANIFEST, tools: ['claude-code', 'codex', 'gemini'] };
    const files = inferInstalledFiles(manifest);
    expect(files).toHaveLength(new Set(files).size);
  });
});
