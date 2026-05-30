// These tests validate data files, but some SKILL.md text is also the runtime
// contract for agent behavior. The targeted text assertions below guard against
// quiet regressions where prompt/skill rewrites drop required review modes,
// evidence commands, scope rules, or final output headings. Keep them focused
// on behavior-shaping terms rather than general copy-editing preferences.

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

const getMarkdownSection = (raw: string, heading: string): string => {
  const marker = `### \`${heading}\``;
  const start = raw.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing markdown section: ${heading}`);
  }

  const next = raw.indexOf('\n### `', start + marker.length);
  return raw.slice(start, next < 0 ? undefined : next);
};

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

  it('ai-ops-project-owned-docs는 project-owned 문서 배치와 승인 후 편집 계약을 포함한다', () => {
    const entry = findSkillEntry('ai-ops-project-owned-docs');
    const skillRaw = readFileSync(resolve(skillsDir, 'task-skills/ai-ops-project-owned-docs/SKILL.md'), 'utf-8');
    const openaiMetadata = OpenAiSkillMetadataSchema.parse(
      parse(readFileSync(resolve(skillsDir, 'task-skills/ai-ops-project-owned-docs/agents/openai.yaml'), 'utf-8')),
    );

    expect(entry.kind).toBe('task');
    expect(entry.supported_tools).toEqual(['codex']);
    expect(entry.groups).toContain('agent-operating-layer');
    expect(skillRaw).toContain('$ai-ops-project-owned-docs');
    expect(skillRaw).toContain('single project-owned docs placement and editing specialist');
    expect(skillRaw).toContain('note-placement');
    expect(skillRaw).toContain('diff-impact');
    expect(skillRaw).toContain('conversation-learning');
    expect(skillRaw).toContain('git diff --cached --stat');
    expect(skillRaw).toContain('Do not invent a rule from implementation details alone');
    expect(skillRaw).toContain('docs/agent/project-rules/*.md');
    expect(skillRaw).toContain('docs/docs-status.md');
    expect(skillRaw).toContain('.ai-ops/context-layer.json');
    expect(skillRaw).toContain('managed baseline docs');
    expect(skillRaw).toContain('AGENTS.md');
    expect(skillRaw).toContain('docs/agent/rules/*');
    expect(skillRaw).toContain('docs/agent/checks/*');
    expect(skillRaw).not.toContain('docs/agent/rules/doc-update-rules.md');
    expect(skillRaw).toContain('Do not edit files before the user confirms');
    expect(skillRaw).toContain('ai-ops update');
    expect(skillRaw).toContain('ai-ops audit');
    expect(skillRaw).toContain('Do not stage, commit, or amend');
    expect(skillRaw).not.toContain('context-promotion receipts');
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

  it('code-review-scope-map은 6개 target mode별 trigger와 evidence protocol을 고정한다', () => {
    const skillRaw = loadCodeReviewSkillRaw('code-review-scope-map');
    const modeContracts = [
      {
        mode: 'plan_current_changes',
        triggers: ['현재 변경사항은 [plan] 구현', 'current changes implement [plan]', 'this work implements [plan]'],
        evidence: ['git status --short', 'git diff --stat', 'git diff --cached', 'git ls-files --others --exclude-standard'],
      },
      {
        mode: 'plan_head_commit',
        triggers: ['직전 커밋은 [계획 문서] 구현', 'HEAD commit implements [plan]', '직전 커밋', 'HEAD commit'],
        evidence: ['git show --stat HEAD', 'git show --name-only HEAD', 'git show HEAD'],
      },
      {
        mode: 'project_wide',
        triggers: ['이 프로젝트 전체', 'project-wide'],
        evidence: ['rg --files', 'registry/schema reads', 'docs/status reads'],
      },
      {
        mode: 'feature',
        triggers: ['기능', 'feature'],
        evidence: ['rg -n', 'rg --files', 'direct reads of matched files'],
      },
      {
        mode: 'module',
        triggers: ['모듈', 'module'],
        evidence: ['rg --files', 'targeted `rg -n` symbol/package search', 'path existence checks'],
      },
      {
        mode: 'diff_default',
        triggers: ['현재 변경사항', 'current changes', 'current diff', 'no plan, commit, feature, module, or project-wide target'],
        evidence: ['git status --short', 'git diff --stat', 'git diff --cached', 'git ls-files --others --exclude-standard'],
      },
    ] as const;

    for (const contract of modeContracts) {
      const section = getMarkdownSection(skillRaw, contract.mode);

      expect(section).toContain(contract.mode);
      for (const trigger of contract.triggers) {
        expect(section).toContain(trigger);
      }
      for (const evidence of contract.evidence) {
        expect(section).toContain(evidence);
      }
    }
  });

  it('code-review-scope-map은 Phase 3 output fields와 ambiguity stop 조건을 고정한다', () => {
    const skillRaw = loadCodeReviewSkillRaw('code-review-scope-map');

    expect(skillRaw).toContain('target mode');
    expect(skillRaw).toContain('target identifier');
    expect(skillRaw).toContain('included surface');
    expect(skillRaw).toContain('excluded surface');
    expect(skillRaw).toContain('required evidence');
    expect(skillRaw).toContain('focused passes to run');
    expect(skillRaw).toContain('ambiguity');
    expect(skillRaw).toContain('Ambiguity stop');
    expect(skillRaw).toContain('Do not run focused review passes when `ambiguity` is present');
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

    expect(skillRaw).toContain('included surface');
    expect(skillRaw).toContain('excluded surface');
    expect(skillRaw).toContain('project_wide');
    expect(skillRaw).toContain('feature');
    expect(skillRaw).toContain('module');
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
      expect(skillRaw).toContain('Scope compliance');
      expect(skillRaw).toContain('included surface');
      expect(skillRaw).toContain('excluded surface');
      expect(skillRaw).toContain('미실행/남은 확인');
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
