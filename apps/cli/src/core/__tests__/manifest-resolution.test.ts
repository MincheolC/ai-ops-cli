import { describe, it, expect } from 'vitest';
import { resolveManifestRules } from '../manifest-resolution.js';
import type { Manifest, Preset, Rule } from '../schemas/index.js';

const makeRule = (id: string, priority: number): Rule => ({
  id,
  category: 'general',
  tags: ['general'],
  priority,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  content: {
    constraints: [],
    guidelines: [`${id} guideline`],
  },
});

describe('resolveManifestRules', () => {
  const allRules = [makeRule('role-persona', 90), makeRule('communication', 85), makeRule('code-philosophy', 80)];
  const presets: Preset[] = [
    {
      id: 'frontend-web',
      description: 'frontend',
      rules: ['role-persona', 'communication'],
    },
  ];

  it('현재 preset 기준으로 installed rules를 재해석한다', () => {
    const manifest: Manifest = {
      tools: ['codex'],
      scope: 'project',
      preset: 'frontend-web',
      installed_rules: ['role-persona', 'legacy-rule'],
      sourceHash: 'a1b2c3',
      generatedAt: '2026-03-13T00:00:00.000Z',
    };

    const resolved = resolveManifestRules({
      manifest,
      allRules,
      presets,
    });

    expect(resolved.installedRules.map((rule) => rule.id)).toEqual(['role-persona', 'communication']);
  });

  it('모노레포는 workspace preset 기준으로 rules를 재구성한다', () => {
    const manifest: Manifest = {
      tools: ['codex'],
      scope: 'project',
      workspaces: {
        web: { preset: 'frontend-web', rules: ['legacy-rule'] },
      },
      installed_rules: ['legacy-rule'],
      sourceHash: 'a1b2c3',
      generatedAt: '2026-03-13T00:00:00.000Z',
    };

    const resolved = resolveManifestRules({
      manifest,
      allRules,
      presets,
    });

    expect(resolved.workspaces).toEqual({
      web: { preset: 'frontend-web', rules: ['role-persona', 'communication'] },
    });
    expect(resolved.installedRules.map((rule) => rule.id)).toEqual(['role-persona', 'communication']);
  });
});
