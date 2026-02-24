import { describe, it, expect } from 'vitest';
import { RuleSchema } from '../rule.schema.js';

const validRule = {
  id: 'typescript-naming',
  category: 'typescript',
  tags: ['naming', 'convention'],
  priority: 50,
  content: {
    constraints: ['Do not use any'],
    guidelines: ['Use const by default'],
    decision_table: [{ when: 'state needed', then: 'use useState', avoid: 'direct mutation' }],
  },
};

describe('RuleSchema', () => {
  describe('valid', () => {
    it('전체 필드', () => {
      expect(RuleSchema.parse(validRule)).toEqual(validRule);
    });

    it('decision_table 생략', () => {
      const input = {
        ...validRule,
        content: {
          constraints: validRule.content.constraints,
          guidelines: validRule.content.guidelines,
        },
      };
      expect(() => RuleSchema.parse(input)).not.toThrow();
    });

    it('decision_table.avoid 생략', () => {
      const input = {
        ...validRule,
        content: {
          ...validRule.content,
          decision_table: [{ when: 'condition', then: 'action' }],
        },
      };
      expect(() => RuleSchema.parse(input)).not.toThrow();
    });

    it('priority 경계값 0', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: 0 })).not.toThrow();
    });

    it('priority 경계값 100', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: 100 })).not.toThrow();
    });

    it('constraints/guidelines 빈 배열 허용', () => {
      const input = {
        ...validRule,
        content: { constraints: [], guidelines: [] },
      };
      expect(() => RuleSchema.parse(input)).not.toThrow();
    });
  });

  describe('invalid', () => {
    it('non-kebab id (언더스코어)', () => {
      expect(() => RuleSchema.parse({ ...validRule, id: 'typescript_naming' })).toThrow();
    });

    it('non-kebab id (대문자)', () => {
      expect(() => RuleSchema.parse({ ...validRule, id: 'TypeScript-naming' })).toThrow();
    });

    it('id 선행/후행 하이픈', () => {
      expect(() => RuleSchema.parse({ ...validRule, id: '-typescript-naming' })).toThrow();
      expect(() => RuleSchema.parse({ ...validRule, id: 'typescript-naming-' })).toThrow();
    });

    it('priority 범위 초과 (101)', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: 101 })).toThrow();
    });

    it('priority 음수 (-1)', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: -1 })).toThrow();
    });

    it('priority 소수점', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: 50.5 })).toThrow();
    });

    it('priority 문자열', () => {
      expect(() => RuleSchema.parse({ ...validRule, priority: 'high' })).toThrow();
    });

    it('필수 필드 누락 (id)', () => {
      const { id: _id, ...rest } = validRule;
      expect(() => RuleSchema.parse(rest)).toThrow();
    });

    it('필수 필드 누락 (category)', () => {
      const { category: _c, ...rest } = validRule;
      expect(() => RuleSchema.parse(rest)).toThrow();
    });

    it('constraints 빈 문자열 포함', () => {
      expect(() =>
        RuleSchema.parse({
          ...validRule,
          content: { ...validRule.content, constraints: [''] },
        }),
      ).toThrow();
    });

    it('guidelines 빈 문자열 포함', () => {
      expect(() =>
        RuleSchema.parse({
          ...validRule,
          content: { ...validRule.content, guidelines: [''] },
        }),
      ).toThrow();
    });

    it('unknown 필드 (root)', () => {
      expect(() => RuleSchema.parse({ ...validRule, unknown: 'field' })).toThrow();
    });

    it('unknown 필드 (content)', () => {
      expect(() =>
        RuleSchema.parse({
          ...validRule,
          content: { ...validRule.content, extra: true },
        }),
      ).toThrow();
    });
  });
});
