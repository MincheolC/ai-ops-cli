import { describe, expect, it } from 'vitest';
import { buildSkillInstallPlan } from '../skill-renderer.js';
import type { Rule, Skill } from '../schemas/index.js';

const makeRule = (id: string): Rule => ({
  id,
  category: 'standard',
  tags: ['test'],
  priority: 50,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  content: {
    constraints: ['Do not do x'],
    guidelines: ['Do y'],
  },
});

const makeSkill = (partial?: Partial<Skill>): Skill => ({
  id: 'graphql-contract',
  kind: 'reference',
  description: 'Use when editing GraphQL contracts.',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  allow_implicit_invocation: true,
  install_scopes: ['project', 'user'],
  instructions: 'Load this skill for GraphQL contract work.',
  source_rules: ['graphql-core'],
  ...partial,
});

describe('buildSkillInstallPlan', () => {
  it('codex+gemini는 .agents/skills 하나로 공유 설치한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill(),
      allRules: [makeRule('graphql-core')],
      requestedTools: ['codex', 'gemini'],
      scope: 'project',
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.rootDir).toBe('.agents/skills/graphql-contract');
    expect(result.installedSkill.installed_paths).toEqual(['.agents/skills/graphql-contract']);
  });

  it('claude-code는 .claude/skills에 설치한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill(),
      allRules: [makeRule('graphql-core')],
      requestedTools: ['claude-code'],
      scope: 'project',
    });

    expect(result.packages[0]?.rootDir).toBe('.claude/skills/graphql-contract');
  });

  it('task skill scripts를 scripts/ 하위에 렌더링한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill({
        id: 'skill-load-check',
        kind: 'task',
        source_rules: undefined,
        scripts: [{ path: 'loaded.js', content: "console.log('A Skill loaded')" }],
      }),
      allRules: [],
      requestedTools: ['codex'],
      scope: 'user',
    });

    expect(result.packages[0]?.files.some((file) => file.relativePath.endsWith('scripts/loaded.js'))).toBe(true);
  });
});
