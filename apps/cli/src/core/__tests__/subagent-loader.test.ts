import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadAllSubagents, loadSubagentCatalog } from '../../shared/catalog-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

const codeReviewSkillNames = [
  'code-review-scope-map',
  'code-review-correctness',
  'code-review-security',
  'code-review-state-concurrency',
  'code-review-test-quality',
  'code-review-architecture-ops',
  'code-review-final-gate',
] as const;

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'subagent-loader-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

const writeValidCatalog = (dir: string, sourcePath = 'security-gate'): void => {
  writeFileSync(
    join(dir, 'subagent-registry.json'),
    JSON.stringify({
      subagents: [
        {
          id: 'security-gate',
          supported_tools: ['claude-code', 'codex', 'gemini'],
          source_path: sourcePath,
        },
      ],
    }),
    'utf-8',
  );
};

const writeValidSource = (dir: string): void => {
  const sourceDir = join(dir, 'security-gate');
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, 'PROMPT.md'), 'Prompt body', 'utf-8');
  writeFileSync(
    join(sourceDir, 'claude.frontmatter.yaml'),
    'name: security-gate\ndescription: Gate changes.\n',
    'utf-8',
  );
  writeFileSync(
    join(sourceDir, 'codex.frontmatter.toml'),
    'name = "security-gate"\ndescription = "Gate changes."\nskill_names = ["spec-security-01-triage"]\n',
    'utf-8',
  );
  writeFileSync(
    join(sourceDir, 'gemini.frontmatter.yaml'),
    'name: security-gate\ndescription: Gate changes.\n',
    'utf-8',
  );
};

describe('loadSubagentCatalog', () => {
  it('subagent-registry.json을 로드한다', () => {
    const { dir, cleanup } = setup();
    try {
      writeValidCatalog(dir);
      expect(loadSubagentCatalog(dir).subagents[0]?.id).toBe('security-gate');
    } finally {
      cleanup();
    }
  });
});

describe('loadAllSubagents', () => {
  it('실제 data/subagents의 초기 subagent 3개를 로드한다', () => {
    const subagents = loadAllSubagents(resolve(dataDir, 'subagents'));

    expect(subagents.map((subagent) => subagent.id)).toEqual([
      'code-review-gate',
      'security-gate',
      'security-reviewer',
    ]);
  });

  it('code-review-gate Codex frontmatter는 read-only sandbox와 모든 review skill을 선언한다', () => {
    const subagents = loadAllSubagents(resolve(dataDir, 'subagents'));
    const subagent = subagents.find((candidate) => candidate.id === 'code-review-gate');
    if (!subagent) {
      throw new Error('Missing code-review-gate subagent');
    }

    expect(subagent.frontmatter.codex.raw).toContain('sandbox_mode = "read-only"');
    expect(subagent.frontmatter.codex.parsed.skill_names).toEqual([...codeReviewSkillNames]);
  });

  it('code-review-gate prompt는 explicit-only read-only scope-map-first 흐름을 포함한다', () => {
    const subagents = loadAllSubagents(resolve(dataDir, 'subagents'));
    const subagent = subagents.find((candidate) => candidate.id === 'code-review-gate');
    if (!subagent) {
      throw new Error('Missing code-review-gate subagent');
    }

    expect(subagent.prompt).toContain('explicit-only');
    expect(subagent.prompt).toContain('read-only');
    expect(subagent.prompt).toContain('Do not edit files');
    expect(subagent.prompt).toContain('Do not stage');
    expect(subagent.prompt).toContain('Do not commit');
    expect(subagent.prompt).toContain('scope-map -> focused passes -> final-gate');
    expect(subagent.prompt).toContain('scope-map-first');
    expect(subagent.prompt).toContain('plan_current_changes');
    expect(subagent.prompt).toContain('plan_head_commit');
    expect(subagent.prompt).toContain('project_wide');
    expect(subagent.prompt).toContain('diff_default');
    expect(subagent.prompt).toContain('current changes');
    expect(subagent.prompt).toContain('HEAD commit');
    expect(subagent.prompt).toContain('plan-vs-implementation');
    expect(subagent.prompt).toContain('project-wide');
    expect(subagent.prompt).toContain('feature');
    expect(subagent.prompt).toContain('module');
    expect(subagent.prompt).toContain('target clarification');
    expect(subagent.prompt).toContain('bare current changes/current diff review without a plan');
    expect(subagent.prompt).toContain('If the scope map returns `ambiguity`, do not run focused review passes');
    expect(subagent.prompt).toContain('do not claim complete coverage');
    expect(subagent.prompt).toContain('Do not use the excluded surface as a finding source');
    expect(subagent.prompt).toContain('directly connected shared auth/policy/schema/test helper code');
  });

  it('필수 source 파일을 읽고 도구별 frontmatter를 검증한다', () => {
    const { dir, cleanup } = setup();
    try {
      writeValidCatalog(dir);
      writeValidSource(dir);
      const subagents = loadAllSubagents(dir);

      expect(subagents).toHaveLength(1);
      expect(subagents[0]?.frontmatter.codex.parsed.skill_names).toEqual(['spec-security-01-triage']);
    } finally {
      cleanup();
    }
  });

  it('Codex frontmatter name은 catalog id와 달라도 spawn name으로 보존한다', () => {
    const { dir, cleanup } = setup();
    try {
      writeValidCatalog(dir);
      writeValidSource(dir);
      writeFileSync(
        join(dir, 'security-gate', 'codex.frontmatter.toml'),
        'name = "security_gate"\ndescription = "Gate changes."\nskill_names = ["spec-security-01-triage"]\n',
        'utf-8',
      );

      const subagents = loadAllSubagents(dir);

      expect(subagents[0]?.id).toBe('security-gate');
      expect(subagents[0]?.frontmatter.codex.parsed.name).toBe('security_gate');
    } finally {
      cleanup();
    }
  });

  it('필수 파일이 없으면 명확히 실패한다', () => {
    const { dir, cleanup } = setup();
    try {
      writeValidCatalog(dir);
      mkdirSync(join(dir, 'security-gate'), { recursive: true });

      expect(() => loadAllSubagents(dir)).toThrow('Required subagent source file is missing');
    } finally {
      cleanup();
    }
  });

  it('frontmatter name이 registry id와 다르면 실패한다', () => {
    const { dir, cleanup } = setup();
    try {
      writeValidCatalog(dir);
      writeValidSource(dir);
      writeFileSync(
        join(dir, 'security-gate', 'gemini.frontmatter.yaml'),
        'name: wrong-name\ndescription: Gate changes.\n',
        'utf-8',
      );

      expect(() => loadAllSubagents(dir)).toThrow('Subagent gemini frontmatter name mismatch');
    } finally {
      cleanup();
    }
  });
});
