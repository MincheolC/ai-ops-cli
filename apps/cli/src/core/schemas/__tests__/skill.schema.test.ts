import { describe, expect, it } from 'vitest';
import { SkillCatalogEntrySchema } from '../skill-catalog.schema.js';
import { SkillFrontmatterSchema, InstalledSkillSchema } from '../skill.schema.js';

const validSkillFrontmatter = {
  name: 'graphql-contract',
  description: 'Use when editing GraphQL contracts and schema evolution rules.',
};

const validSkillCatalogEntry = {
  id: 'graphql-contract',
  kind: 'reference' as const,
  supported_tools: ['claude-code', 'codex', 'gemini'],
  groups: ['frontend-web', 'backend-ts'],
  source_path: 'reference-skills/graphql-contract',
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

describe('SkillCatalogEntrySchema', () => {
  it('parses centralized catalog metadata', () => {
    expect(SkillCatalogEntrySchema.parse(validSkillCatalogEntry)).toEqual(validSkillCatalogEntry);
  });

  it('rejects mismatched kind/source_path root', () => {
    expect(() =>
      SkillCatalogEntrySchema.parse({
        ...validSkillCatalogEntry,
        kind: 'task',
      }),
    ).toThrow('source_path must start with task-skills/');
  });
});

describe('InstalledSkillSchema', () => {
  it('parses installed skill metadata', () => {
    expect(
      InstalledSkillSchema.parse({
        id: 'graphql-contract',
        kind: 'reference',
        tools: ['codex'],
        installed_paths: ['.agents/skills/graphql-contract'],
        sourceHash: 'a1b2c3',
      }),
    ).toMatchObject({
      id: 'graphql-contract',
      tools: ['codex'],
    });
  });

  it('strips legacy fields from installed skill metadata', () => {
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
    ).toEqual({
      id: 'graphql-contract',
      kind: 'reference',
      tools: ['codex'],
      installed_paths: ['.agents/skills/graphql-contract'],
      sourceHash: 'a1b2c3',
    });
  });
});
