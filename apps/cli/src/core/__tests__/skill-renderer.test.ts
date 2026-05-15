import { describe, expect, it } from 'vitest';
import { buildSkillInstallPlan } from '../skill-renderer.js';
import type { Skill } from '../schemas/index.js';

const makeSkill = (partial?: Partial<Skill>): Skill => ({
  id: 'graphql-contract',
  kind: 'reference',
  description: 'Use when editing GraphQL contracts.',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  groups: ['frontend-web'],
  included_in_presets: ['frontend-web'],
  directory: '/tmp/graphql-contract',
  files: [
    {
      path: 'SKILL.md',
      content: '# GraphQL Contract\n\nRead references/reference.md.',
    },
    {
      path: 'references/reference.md',
      content: 'Detailed GraphQL contract guidance.',
    },
  ],
  ...partial,
});

describe('buildSkillInstallPlan', () => {
  it('codex+gemini는 .agents/skills 하나로 공유 설치한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill(),
      requestedTools: ['codex', 'gemini'],
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0]?.rootDir).toBe('.agents/skills/graphql-contract');
    expect(result.installedSkill.installed_paths).toEqual(['.agents/skills/graphql-contract']);
  });

  it('claude-code는 .claude/skills에 설치한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill(),
      requestedTools: ['claude-code'],
    });

    expect(result.packages[0]?.rootDir).toBe('.claude/skills/graphql-contract');
  });

  it('task skill scripts를 scripts/ 하위에 렌더링한다', () => {
    const result = buildSkillInstallPlan({
      skill: makeSkill({
        id: 'skill-load-check',
        kind: 'task',
        directory: '/tmp/skill-load-check',
        files: [
          {
            path: 'SKILL.md',
            content: '# Skill Load Check\n\nRun scripts/loaded.js.',
          },
          {
            path: 'scripts/loaded.js',
            content: "console.log('A Skill loaded');",
          },
        ],
      }),
      requestedTools: ['codex'],
    });

    expect(result.packages[0]?.files.some((file) => file.relativePath.endsWith('scripts/loaded.js'))).toBe(true);
  });
});
