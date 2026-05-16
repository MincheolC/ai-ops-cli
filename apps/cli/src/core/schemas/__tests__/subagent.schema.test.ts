import { describe, expect, it } from 'vitest';
import { SubagentCatalogEntrySchema } from '../subagent-catalog.schema.js';
import {
  CodexSubagentFrontmatterSchema,
  InstalledSubagentSchema,
  SubagentMarkdownFrontmatterSchema,
} from '../subagent.schema.js';

const validCatalogEntry = {
  id: 'security-gate',
  supported_tools: ['claude-code', 'codex', 'gemini'],
  source_path: 'security-gate',
};

describe('SubagentCatalogEntrySchema', () => {
  it('subagent catalog metadata를 검증한다', () => {
    expect(SubagentCatalogEntrySchema.parse(validCatalogEntry)).toEqual(validCatalogEntry);
  });

  it('non-kebab id를 거부한다', () => {
    expect(() =>
      SubagentCatalogEntrySchema.parse({
        ...validCatalogEntry,
        id: 'security_gate',
      }),
    ).toThrow('id must be kebab-case');
  });

  it('relative kebab-case source_path만 허용한다', () => {
    expect(() =>
      SubagentCatalogEntrySchema.parse({
        ...validCatalogEntry,
        source_path: '../security-gate',
      }),
    ).toThrow('source_path must be relative kebab-case path');
  });
});

describe('SubagentFrontmatterSchema', () => {
  it('Claude/Gemini YAML frontmatter의 name과 description을 검증하고 extra field를 보존한다', () => {
    expect(
      SubagentMarkdownFrontmatterSchema.parse({
        name: 'security-gate',
        description: 'Decide whether review is required.',
        model: 'haiku',
      }),
    ).toMatchObject({
      name: 'security-gate',
      description: 'Decide whether review is required.',
      model: 'haiku',
    });
  });

  it('Codex TOML frontmatter의 skill_names를 검증한다', () => {
    expect(
      CodexSubagentFrontmatterSchema.parse({
        name: 'security-gate',
        description: 'Decide whether review is required.',
        model: 'gpt-5.4-mini',
        skill_names: ['spec-security-01-triage'],
      }),
    ).toMatchObject({
      name: 'security-gate',
      skill_names: ['spec-security-01-triage'],
    });
  });
});

describe('InstalledSubagentSchema', () => {
  it('installed subagent metadata를 검증한다', () => {
    expect(
      InstalledSubagentSchema.parse({
        id: 'security-gate',
        tools: ['codex'],
        installed_paths: ['.codex/agents/security-gate.toml'],
        sourceHash: 'a1b2c3',
      }),
    ).toEqual({
      id: 'security-gate',
      tools: ['codex'],
      installed_paths: ['.codex/agents/security-gate.toml'],
      sourceHash: 'a1b2c3',
    });
  });

  it('AI_OPS_HOME 밖으로 나가는 installed_paths를 거부한다', () => {
    expect(() =>
      InstalledSubagentSchema.parse({
        id: 'security-gate',
        tools: ['codex'],
        installed_paths: ['../outside'],
        sourceHash: 'a1b2c3',
      }),
    ).toThrow('installed path must be safe relative path');
  });

  it('id/tools에서 계산되는 expected path와 다른 installed_paths를 거부한다', () => {
    expect(() =>
      InstalledSubagentSchema.parse({
        id: 'security-gate',
        tools: ['codex'],
        installed_paths: ['.claude/agents/security-gate.md'],
        sourceHash: 'a1b2c3',
      }),
    ).toThrow('installed_paths must match id and tools');
  });
});
