import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { parseMarkdownFrontmatter } from '../../../shared/markdown/frontmatter.js';
import { IntegrationCatalogSchema } from '../integration-catalog.schema.js';
import { SkillCatalogSchema } from '../skill-catalog.schema.js';
import { SkillFrontmatterSchema } from '../skill.schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, '../../../../data/skills');
const skillCatalogPath = resolve(skillsDir, 'skill-registry.json');
const integrationsDir = resolve(__dirname, '../../../../data/integrations');
const integrationCatalogPath = resolve(integrationsDir, 'integration-registry.json');

const skillCatalog = SkillCatalogSchema.parse(JSON.parse(readFileSync(skillCatalogPath, 'utf-8')));
const integrationCatalog = IntegrationCatalogSchema.parse(JSON.parse(readFileSync(integrationCatalogPath, 'utf-8')));

const loadSkillFrontmatter = (sourcePath: string): unknown => {
  const raw = readFileSync(resolve(skillsDir, sourcePath, 'SKILL.md'), 'utf-8');
  return parseMarkdownFrontmatter(raw).frontmatter;
};

const loadSkillRaw = (sourcePath: string): string => readFileSync(resolve(skillsDir, sourcePath, 'SKILL.md'), 'utf-8');

const skillEntries = [...skillCatalog.skills].sort((a, b) => a.id.localeCompare(b.id));
const OpenAiSkillMetadataSchema = z.object({
  policy: z.object({
    allow_implicit_invocation: z.boolean(),
  }),
});

const codeReviewSkillIds = [
  'code-review-scope-map',
  'code-review-correctness',
  'code-review-security',
  'code-review-state-concurrency',
  'code-review-test-quality',
  'code-review-architecture-ops',
  'code-review-final-gate',
] as const;

const focusedCodeReviewSkillIds = [
  'code-review-correctness',
  'code-review-security',
  'code-review-state-concurrency',
  'code-review-test-quality',
  'code-review-architecture-ops',
] as const;

const findSkillEntry = (id: string): (typeof skillEntries)[number] => {
  const entry = skillEntries.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Missing skill registry entry: ${id}`);
  }
  return entry;
};

const loadCodeReviewSkillRaw = (id: string): string => loadSkillRaw(findSkillEntry(id).source_path);

const loadOpenAiSkillMetadata = (sourcePath: string): z.infer<typeof OpenAiSkillMetadataSchema> =>
  OpenAiSkillMetadataSchema.parse(parse(readFileSync(resolve(skillsDir, sourcePath, 'agents/openai.yaml'), 'utf-8')));

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
    expect(skillRaw).toContain('git status --short');
    expect(skillRaw).toContain('git diff --name-only');
    expect(skillRaw).toContain('git diff --cached --name-only');
    expect(skillRaw).toContain('git ls-files --others --exclude-standard');
    expect(skillRaw).toContain('git show --stat HEAD');
    expect(skillRaw).toContain('git show --name-only HEAD');
    expect(skillRaw).toContain('git show HEAD');
    expect(skillRaw).toContain('현재 대화/리뷰 루프');
    expect(skillRaw).toContain('사용자가 교정한 운영 판단');
    expect(skillRaw).toContain('near-miss / discarded candidates');
    expect(skillRaw).toContain('Active context layer에 같은 agent 행동 규칙');
    expect(skillRaw).toContain('changeset pollution');
    expect(skillRaw).toContain('staging scope');
    expect(skillRaw).toContain('Project root');
    expect(skillRaw).toContain('웹 검색 금지');
    expect(skillRaw).toContain('다른 repo 탐색 금지');
    expect(skillRaw).toContain('없으면 absent로 기록');
    expect(skillRaw).toContain('사용자 승인 전 편집 금지');
    expect(skillRaw).toContain('ai-ops context-promotion resolve');
    expect(skillRaw).toContain('receipt 확인 필수');
    expect(skillRaw).toContain('직접 commit 금지');
    expect(skillRaw).toContain('사용자 검사 대기');
    expect(skillRaw).toContain('core');
    expect(skillRaw).toContain('project-local');
    expect(skillRaw).toContain('global');
    expect(skillRaw).toContain('already-covered');
    expect(skillRaw).toContain('다섯 가지');
    expect(openaiMetadata.policy.allow_implicit_invocation).toBe(false);
  });

  it('code-review-gate task skills는 Codex explicit-only metadata를 가진다', () => {
    for (const id of codeReviewSkillIds) {
      const entry = findSkillEntry(id);
      const openaiMetadata = loadOpenAiSkillMetadata(entry.source_path);

      expect(entry.kind).toBe('task');
      expect(entry.supported_tools).toEqual(['codex']);
      expect(entry.groups).toContain('code-review-gate');
      expect(openaiMetadata.policy.allow_implicit_invocation).toBe(false);
    }
  });

  it('code-review-scope-map은 6개 target mode와 read-only evidence surface를 고정한다', () => {
    const skillRaw = loadCodeReviewSkillRaw('code-review-scope-map');

    expect(skillRaw).toContain('plan_current_changes');
    expect(skillRaw).toContain('plan_head_commit');
    expect(skillRaw).toContain('project_wide');
    expect(skillRaw).toContain('feature');
    expect(skillRaw).toContain('module');
    expect(skillRaw).toContain('diff_default');
    expect(skillRaw).toContain('target mode');
    expect(skillRaw).toContain('included surface');
    expect(skillRaw).toContain('excluded surface');
    expect(skillRaw).toContain('Ambiguity stop');
    expect(skillRaw).toContain('git status --short');
    expect(skillRaw).toContain('git diff --stat');
    expect(skillRaw).toContain('git diff');
    expect(skillRaw).toContain('git diff --cached --stat');
    expect(skillRaw).toContain('git diff --cached');
    expect(skillRaw).toContain('git ls-files --others --exclude-standard');
    expect(skillRaw).toContain('git show --stat HEAD');
    expect(skillRaw).toContain('git show --name-only HEAD');
    expect(skillRaw).toContain('git show HEAD');
  });

  it('code-review-final-gate는 최종 출력 계약을 고정한다', () => {
    const skillRaw = loadCodeReviewSkillRaw('code-review-final-gate');

    expect(skillRaw).toContain('**Findings**');
    expect(skillRaw).toContain('[P0]');
    expect(skillRaw).toContain('[P1]');
    expect(skillRaw).toContain('[P2]');
    expect(skillRaw).toContain('[P3]');
    expect(skillRaw).toContain('file/line evidence');
    expect(skillRaw).toContain('**검증**');
    expect(skillRaw).toContain('통과:');
    expect(skillRaw).toContain('미실행/남은 확인:');
    expect(skillRaw).toContain('Never present planned checks as passed');
  });

  it('focused code-review skills는 file/line evidence와 no generic advice 원칙을 포함한다', () => {
    for (const id of focusedCodeReviewSkillIds) {
      const skillRaw = loadCodeReviewSkillRaw(id);

      expect(skillRaw).toContain('file/line evidence');
      expect(skillRaw).toContain('no generic advice');
    }
  });

  it('focused code-review skills는 계획된 리뷰 렌즈 키워드를 포함한다', () => {
    const expectedTerms = {
      'code-review-correctness': [
        'requirement mismatch',
        'business invariant',
        'compatibility',
        'edge cases',
        'contract regression',
      ],
      'code-review-security': [
        'authentication',
        'authorization',
        'ownership',
        'token',
        'secret',
        'PII',
        'sandbox',
        'user-owned file',
      ],
      'code-review-state-concurrency': [
        'manifest/file lifecycle',
        'partial updates',
        'stale hash',
        'retry',
        'idempotency',
        'install/update/uninstall ordering',
      ],
      'code-review-test-quality': ['missing', 'weak', 'suspicious tests', 'mocks', 'acceptance criteria'],
      'code-review-architecture-ops': [
        'structure erosion',
        'lifecycle ownership',
        'migration',
        'rollback',
        'diagnostics',
        'operating risk',
      ],
    } as const;

    for (const [id, terms] of Object.entries(expectedTerms)) {
      const skillRaw = loadCodeReviewSkillRaw(id);
      for (const term of terms) {
        expect(skillRaw).toContain(term);
      }
    }
  });

  it('code-review-gate integration registry는 7개 skill과 1개 subagent만 가진다', () => {
    const integration = integrationCatalog.integrations.find((candidate) => candidate.id === 'code-review-gate');
    if (!integration) {
      throw new Error('Missing code-review-gate integration');
    }

    const skillComponents = integration.components.filter((component) => component.type === 'skill');
    const subagentComponents = integration.components.filter((component) => component.type === 'subagent');

    expect(skillComponents.map((component) => component.id)).toEqual([...codeReviewSkillIds]);
    expect(subagentComponents.map((component) => component.id)).toEqual(['code-review-gate']);
    expect(integration.components.map((component) => component.type)).not.toContain('codex-hook');
    expect(integration.components.map((component) => component.type)).not.toContain('receipt-config');
  });
});
