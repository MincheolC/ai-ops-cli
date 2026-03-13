import { describe, expect, it } from 'vitest';
import { SkillFrontmatterSchema, InstalledSkillSchema } from '../skill.schema.js';

const validSkillFrontmatter = {
  name: 'graphql-contract',
  kind: 'reference' as const,
  description: 'Use when editing GraphQL contracts and schema evolution rules.',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  allow_implicit_invocation: true,
  install_scopes: ['project', 'user'],
  source_rules: ['graphql-core'],
};

describe('SkillFrontmatterSchema', () => {
  it('parses valid skill', () => {
    expect(SkillFrontmatterSchema.parse(validSkillFrontmatter)).toEqual(validSkillFrontmatter);
  });

  it('rejects unknown fields', () => {
    expect(() => SkillFrontmatterSchema.parse({ ...validSkillFrontmatter, extra: true })).toThrow();
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
