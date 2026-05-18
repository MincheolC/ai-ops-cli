import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { parseMarkdownFrontmatter } from '../../frontmatter.js';
import { SkillCatalogSchema } from '../skill-catalog.schema.js';
import { SkillFrontmatterSchema } from '../skill.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, '../../../../data/skills');
const skillCatalogPath = resolve(skillsDir, 'skill-registry.json');

const skillCatalog = SkillCatalogSchema.parse(JSON.parse(readFileSync(skillCatalogPath, 'utf-8')));

const loadSkillFrontmatter = (sourcePath: string): unknown => {
  const raw = readFileSync(resolve(skillsDir, sourcePath, 'SKILL.md'), 'utf-8');
  return parseMarkdownFrontmatter(raw).frontmatter;
};

const skillEntries = [...skillCatalog.skills].sort((a, b) => a.id.localeCompare(b.id));
const OpenAiSkillMetadataSchema = z.object({
  policy: z.object({
    allow_implicit_invocation: z.boolean(),
  }),
});

describe('skill data files', () => {
  it('skill-registry.json이 SkillCatalogSchema를 통과한다', () => {
    expect(() => SkillCatalogSchema.parse(JSON.parse(readFileSync(skillCatalogPath, 'utf-8')))).not.toThrow();
  });

  describe('각 registry source_path의 SKILL.md frontmatter가 SkillFrontmatterSchema를 통과한다', () => {
    for (const entry of skillEntries) {
      it(entry.id, () => {
        expect(() => SkillFrontmatterSchema.parse(loadSkillFrontmatter(entry.source_path))).not.toThrow();
      });
    }
  });

  it('reference skill은 references/reference.md를 가진다', () => {
    for (const entry of skillEntries) {
      if (entry.kind !== 'reference') {
        continue;
      }

      expect(existsSync(resolve(skillsDir, entry.source_path, 'references', 'reference.md'))).toBe(true);
    }
  });

  it('registry source_path가 실제 디렉토리를 가리킨다', () => {
    for (const entry of skillEntries) {
      expect(existsSync(resolve(skillsDir, entry.source_path, 'SKILL.md'))).toBe(true);
    }
  });

  it('doc-impact-reviewer는 수동 호출과 문서 영향 판정 계약을 포함한다', () => {
    const skillRaw = readFileSync(resolve(skillsDir, 'task-skills/doc-impact-reviewer/SKILL.md'), 'utf-8');
    const openaiMetadata = OpenAiSkillMetadataSchema.parse(
      parse(readFileSync(resolve(skillsDir, 'task-skills/doc-impact-reviewer/agents/openai.yaml'), 'utf-8')),
    );

    expect(skillRaw).toContain('diff 확인');
    expect(skillRaw).toContain('git diff --cached --stat');
    expect(skillRaw).toContain('git diff --cached');
    expect(skillRaw).toContain('git diff --cached --name-only');
    expect(skillRaw).toContain('문서 후보 제안');
    expect(skillRaw).toContain('사용자 컨펌 전 편집 금지');
    expect(skillRaw).toContain('직접 commit하지 않는다');
    expect(skillRaw).toContain('직접 커밋 금지');
    expect(skillRaw).toContain('Reserved 승격 금지');
    expect(openaiMetadata.policy.allow_implicit_invocation).toBe(false);
  });

  it('context-promotion-review는 승격 검토와 receipt 계약을 포함한다', () => {
    const skillRaw = readFileSync(resolve(skillsDir, 'task-skills/context-promotion-review/SKILL.md'), 'utf-8');
    const openaiMetadata = OpenAiSkillMetadataSchema.parse(
      parse(readFileSync(resolve(skillsDir, 'task-skills/context-promotion-review/agents/openai.yaml'), 'utf-8')),
    );

    expect(skillRaw).toContain('기존 context layer를 cross-check');
    expect(skillRaw).toContain('git show --stat HEAD');
    expect(skillRaw).toContain('git show --name-only HEAD');
    expect(skillRaw).toContain('git show HEAD');
    expect(skillRaw).toContain('사용자 승인 전 편집 금지');
    expect(skillRaw).toContain('ai-ops context-promotion resolve');
    expect(skillRaw).toContain('receipt 확인 필수');
    expect(skillRaw).toContain('직접 commit 금지');
    expect(skillRaw).toContain('사용자 검사 대기');
    expect(skillRaw).toContain('core');
    expect(skillRaw).toContain('project-local');
    expect(skillRaw).toContain('global');
    expect(openaiMetadata.policy.allow_implicit_invocation).toBe(false);
  });
});
