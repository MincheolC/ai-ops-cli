import { describe, expect, it } from 'vitest';
import { SkillSchema, InstalledSkillSchema } from '../skill.schema.js';

const validSkill = {
  id: 'graphql-contract',
  kind: 'reference' as const,
  description: 'Use when editing GraphQL contracts and schema evolution rules.',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  allow_implicit_invocation: true,
  install_scopes: ['project', 'user'],
  instructions: 'Load this skill for GraphQL contract changes.',
  source_rules: ['graphql-core'],
  scripts: [{ path: 'loaded.js', content: "console.log('A Skill loaded')" }],
};

describe('SkillSchema', () => {
  it('parses valid skill', () => {
    expect(SkillSchema.parse(validSkill)).toEqual(validSkill);
  });

  it('rejects unknown fields', () => {
    expect(() => SkillSchema.parse({ ...validSkill, extra: true })).toThrow();
  });
});

describe('InstalledSkillSchema', () => {
  it('parses installed skill metadata', () => {
    expect(
      InstalledSkillSchema.parse({
        id: 'graphql-contract',
        kind: 'reference',
        tools: ['codex'],
        scope: 'project',
        installed_paths: ['.agents/skills/graphql-contract'],
        sourceHash: 'a1b2c3',
        source_rules: ['graphql-core'],
      }),
    ).toMatchObject({
      id: 'graphql-contract',
      scope: 'project',
    });
  });
});
