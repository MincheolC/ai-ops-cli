import { describe, it, expect } from 'vitest';
import { resolveManifestProjectSkills, resolveManifestRules } from '../manifest-resolution.js';
import type { Manifest, Preset, Rule, Skill } from '../schemas/index.js';

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

const makeReferenceSkill = (id: string): Skill => ({
  id,
  kind: 'reference',
  description: `${id} description`,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  install_scopes: ['project', 'user'],
  directory: `/tmp/${id}`,
  files: [
    { path: 'SKILL.md', content: `---\nname: ${id}\nkind: reference\ndescription: ${id}\nsupported_tools:\n  - codex\ninstall_scopes:\n  - project\n---` },
    { path: 'references/reference.md', content: `${id} reference` },
  ],
});

describe('resolveManifestRules', () => {
  const allRules = [
    makeRule('role-persona', 90),
    makeRule('communication', 85),
    makeRule('code-philosophy', 80),
  ];
  const presets: Preset[] = [
    {
      id: 'frontend-web',
      description: 'frontend',
      rules: ['role-persona', 'communication'],
      skills: ['typescript-language'],
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

describe('resolveManifestProjectSkills', () => {
  const allSkills = [
    makeReferenceSkill('typescript-language'),
    makeReferenceSkill('frontend-web-react-next-runtime'),
  ];

  it('legacy externalized rules를 project skills로 마이그레이션한다', () => {
    const manifest: Manifest = {
      tools: ['codex', 'claude-code'],
      scope: 'project',
      installed_rules: ['typescript', 'react-typescript', 'nextjs'],
      sourceHash: 'a1b2c3',
      generatedAt: '2026-03-13T00:00:00.000Z',
    };

    const resolved = resolveManifestProjectSkills({
      manifest,
      allSkills,
    });

    expect(resolved).toEqual([
      {
        skill: allSkills[0],
        requestedTools: ['codex', 'claude-code'],
      },
      {
        skill: allSkills[1],
        requestedTools: ['codex', 'claude-code'],
      },
    ]);
  });

  it('현재 manifest의 installed_skills가 있으면 해당 tool 설정을 우선 사용한다', () => {
    const manifest: Manifest = {
      tools: ['codex', 'claude-code'],
      scope: 'project',
      installed_rules: ['typescript'],
      installed_skills: [
        {
          id: 'typescript-language',
          kind: 'reference',
          tools: ['codex'],
          scope: 'project',
          installed_paths: ['.agents/skills/typescript-language'],
          sourceHash: 'abc123',
        },
      ],
      sourceHash: 'a1b2c3',
      generatedAt: '2026-03-13T00:00:00.000Z',
    };

    const resolved = resolveManifestProjectSkills({
      manifest,
      allSkills,
    });

    expect(resolved).toEqual([
      {
        skill: allSkills[0],
        requestedTools: ['codex'],
      },
    ]);
  });
});
