import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleIdToTitle, renderDecisionTable, renderRuleToMarkdown, renderRulesToMarkdown } from '../renderer.js';
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
