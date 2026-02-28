import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ruleIdToTitle,
  renderDecisionTable,
  renderRuleToMarkdown,
  renderRulesToMarkdown,
  isGlobalRule,
  partitionRules,
  renderFrontmatter,
  renderClaudeCodeRule,
  renderForTool,
} from '../renderer.js';
import { loadRuleFile } from '../loader.js';
import type { Rule } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const makeRule = (overrides: Partial<Rule> = {}): Rule => ({
  id: 'test-rule',
  category: 'test',
  tags: [],
  priority: 50,
  content: { constraints: [], guidelines: [] },
  ...overrides,
});

describe('ruleIdToTitle', () => {
  it('kebab-case 변환', () => {
    expect(ruleIdToTitle('react-typescript')).toBe('React Typescript');
  });

  it('단일 단어', () => {
    expect(ruleIdToTitle('typescript')).toBe('Typescript');
  });
});

describe('renderDecisionTable', () => {
  it('기본 3열 테이블', () => {
    const result = renderDecisionTable([{ when: 'A', then: 'B', avoid: 'C' }]);
    expect(result).toContain('| When | Then | Avoid |');
    expect(result).toContain('| A | B | C |');
  });

  it('avoid 생략 엔트리 (모든 항목에 avoid 없으면 2열)', () => {
    const result = renderDecisionTable([{ when: 'A', then: 'B' }]);
    expect(result).toContain('| When | Then |');
    expect(result).not.toContain('Avoid');
  });

  it('pipe 문자 escape', () => {
    const result = renderDecisionTable([{ when: 'A|B', then: 'C', avoid: 'D|E' }]);
    expect(result).toContain('A&#124;B');
    expect(result).toContain('D&#124;E');
  });
});

describe('renderRuleToMarkdown', () => {
  it('전체 필드 (constraints + guidelines + decision_table)', () => {
    const rule = makeRule({
      id: 'typescript',
      content: {
        constraints: ['DO NOT use any'],
        guidelines: ['Use arrow functions'],
        decision_table: [{ when: 'Type assertion', then: 'Use Zod', avoid: 'Use as' }],
      },
    });
    const md = renderRuleToMarkdown(rule);
    expect(md).toContain('# Typescript');
    expect(md).toContain('## Constraints');
    expect(md).toContain('- DO NOT use any');
    expect(md).toContain('## Guidelines');
    expect(md).toContain('- Use arrow functions');
    expect(md).toContain('## Decision Table');
  });

  it('decision_table 없음 → 해당 섹션 미출력', () => {
    const rule = makeRule({
      content: { constraints: ['DO NOT'], guidelines: [] },
    });
    const md = renderRuleToMarkdown(rule);
    expect(md).not.toContain('Decision Table');
  });
});

describe('renderRulesToMarkdown', () => {
  it('복수 규칙 → --- separator', () => {
    const rules = [makeRule({ id: 'a' }), makeRule({ id: 'b' })];
    const md = renderRulesToMarkdown(rules);
    expect(md).toContain('---');
  });

  it('단일 규칙 → separator 없음', () => {
    const rules = [makeRule({ id: 'a' })];
    const md = renderRulesToMarkdown(rules);
    expect(md).not.toContain('---');
  });
});

describe('Snapshot', () => {
  it('실제 typescript.yaml 로드 후 렌더링 결과 snapshot', () => {
    const filePath = resolve(__dirname, '../../data/rules/typescript.yaml');
    const rule = loadRuleFile(filePath);
    const md = renderRuleToMarkdown(rule);
    expect(md).toMatchSnapshot();
  });
});

describe('isGlobalRule', () => {
  it('persona category → true', () => {
    expect(isGlobalRule(makeRule({ category: 'persona' }))).toBe(true);
  });

  it('communication category → true', () => {
    expect(isGlobalRule(makeRule({ category: 'communication' }))).toBe(true);
  });

  it('language category → false', () => {
    expect(isGlobalRule(makeRule({ category: 'language' }))).toBe(false);
  });

  it('framework category → false', () => {
    expect(isGlobalRule(makeRule({ category: 'framework' }))).toBe(false);
  });
});

describe('partitionRules', () => {
  it('혼합 입력 → 정확한 분리', () => {
    const rules = [
      makeRule({ id: 'role-persona', category: 'persona' }),
      makeRule({ id: 'typescript', category: 'language' }),
      makeRule({ id: 'communication', category: 'communication' }),
      makeRule({ id: 'nextjs', category: 'framework' }),
    ];
    const { global, domain } = partitionRules(rules);
    expect(global.map((r) => r.id)).toEqual(['role-persona', 'communication']);
    expect(domain.map((r) => r.id)).toEqual(['typescript', 'nextjs']);
  });

  it('빈 배열 → 양쪽 빈 배열', () => {
    const { global, domain } = partitionRules([]);
    expect(global).toEqual([]);
    expect(domain).toEqual([]);
  });

  it('전부 global → domain 빈 배열', () => {
    const rules = [makeRule({ category: 'persona' }), makeRule({ category: 'philosophy' })];
    const { global, domain } = partitionRules(rules);
    expect(global).toHaveLength(2);
    expect(domain).toHaveLength(0);
  });
});

describe('renderFrontmatter', () => {
  it('glob 배열 → YAML frontmatter 블록', () => {
    const result = renderFrontmatter(['**/*.ts', '**/*.tsx']);
    expect(result).toBe('---\npaths:\n  - "**/*.ts"\n  - "**/*.tsx"\n---');
  });

  it('단일 glob → 단일 항목 frontmatter', () => {
    const result = renderFrontmatter(['**/*.py']);
    expect(result).toBe('---\npaths:\n  - "**/*.py"\n---');
  });
});

describe('renderClaudeCodeRule', () => {
  it('domain 룰 (typescript) → frontmatter 포함', () => {
    const rule = makeRule({ id: 'typescript', category: 'language' });
    const result = renderClaudeCodeRule(rule);
    expect(result).toContain('---\npaths:');
    expect(result).toContain('"**/*.ts"');
    expect(result).toContain('# Typescript');
  });

  it('scopedGlobs 전달 시 해당 glob 사용', () => {
    const rule = makeRule({ id: 'typescript', category: 'language' });
    const result = renderClaudeCodeRule(rule, ['backend-ts/**/*.ts', 'web/**/*.ts']);
    expect(result).toContain('"backend-ts/**/*.ts"');
    expect(result).toContain('"web/**/*.ts"');
    expect(result).not.toContain('"**/*.ts"');
  });

  it('global 룰 → frontmatter 없음', () => {
    const rule = makeRule({ id: 'role-persona', category: 'persona' });
    const result = renderClaudeCodeRule(rule);
    expect(result).not.toContain('---');
    expect(result).toContain('# Role Persona');
  });

  it('매핑 없는 domain 룰 → frontmatter 없음 (안전 fallback)', () => {
    const rule = makeRule({ id: 'unknown-domain-rule', category: 'domain' });
    const result = renderClaudeCodeRule(rule);
    expect(result).not.toContain('---');
    expect(result).toContain('# Unknown Domain Rule');
  });
});

describe('renderForTool', () => {
  const globalRule = makeRule({ id: 'role-persona', category: 'persona' });
  const domainRule = makeRule({ id: 'typescript', category: 'language' });
  const rules = [globalRule, domainRule];

  it('claude-code: files 배열 반환, domain 파일에 frontmatter', () => {
    const result = renderForTool('claude-code', rules);
    expect(result.tool).toBe('claude-code');
    if (result.tool !== 'claude-code') return;

    expect(result.files).toHaveLength(2);
    const tsFile = result.files.find((f) => f.fileName === 'typescript.md');
    expect(tsFile).toBeDefined();
    expect(tsFile?.content).toContain('---\npaths:');

    const personaFile = result.files.find((f) => f.fileName === 'role-persona.md');
    expect(personaFile?.content).not.toContain('---');
  });

  it('claude-code + workspaceMappings → workspace-prefixed glob', () => {
    const result = renderForTool('claude-code', rules, [
      { path: 'backend-ts', ruleIds: ['typescript'] },
      { path: 'web', ruleIds: ['typescript'] },
    ]);
    if (result.tool !== 'claude-code') return;

    const tsFile = result.files.find((f) => f.fileName === 'typescript.md');
    expect(tsFile?.content).toContain('"backend-ts/**/*.ts"');
    expect(tsFile?.content).toContain('"web/**/*.ts"');
    expect(tsFile?.content).not.toContain('"**/*.ts"');
  });

  it('codex: rootContent에 global만, domainContent에 domain만', () => {
    const result = renderForTool('codex', rules);
    expect(result.tool).toBe('codex');
    if (result.tool !== 'codex') return;

    expect(result.rootContent).toContain('# Role Persona');
    expect(result.rootContent).not.toContain('# Typescript');
    expect(result.domainContent).toContain('# Typescript');
    expect(result.domainContent).not.toContain('# Role Persona');
  });

  it('gemini: rootContent에 global만, domainContent에 domain만', () => {
    const result = renderForTool('gemini', rules);
    expect(result.tool).toBe('gemini');
    if (result.tool !== 'gemini') return;

    expect(result.rootContent).toContain('# Role Persona');
    expect(result.rootContent).not.toContain('# Typescript');
    expect(result.domainContent).toContain('# Typescript');
    expect(result.domainContent).not.toContain('# Role Persona');
  });
});

describe('Snapshot: renderForTool', () => {
  const globalRule = makeRule({
    id: 'communication',
    category: 'communication',
    content: { constraints: ['Be concise'], guidelines: ['Use Korean'] },
  });
  const domainRule = makeRule({
    id: 'typescript',
    category: 'language',
    content: { constraints: ['No any'], guidelines: ['Use arrow functions'] },
  });
  const rules = [globalRule, domainRule];

  it('claude-code snapshot', () => {
    expect(renderForTool('claude-code', rules)).toMatchSnapshot();
  });

  it('codex snapshot', () => {
    expect(renderForTool('codex', rules)).toMatchSnapshot();
  });

  it('gemini snapshot', () => {
    expect(renderForTool('gemini', rules)).toMatchSnapshot();
  });
});
