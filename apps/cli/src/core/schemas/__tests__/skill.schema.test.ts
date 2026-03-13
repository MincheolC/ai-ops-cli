import { describe, expect, it } from 'vitest';
import { SkillFrontmatterSchema, InstalledSkillSchema } from '../skill.schema.js';

const validSkillFrontmatter = {
  name: 'graphql-contract',
  kind: 'reference' as const,
  description: 'Use when editing GraphQL contracts and schema evolution rules.',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  install_scopes: ['project', 'user'],
};

describe('SkillFrontmatterSchema', () => {
  it('parses valid skill', () => {
    expect(SkillFrontmatterSchema.parse(validSkillFrontmatter)).toEqual(validSkillFrontmatter);
  });

  it('allows tool-specific extra fields', () => {
    expect(
      SkillFrontmatterSchema.parse({
        ...validSkillFrontmatter,
        'disable-model-invocation': true,
      }),
    ).toMatchObject(validSkillFrontmatter);
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
      }),
    ).toMatchObject({
      id: 'graphql-contract',
      scope: 'project',
    });
  });
});
