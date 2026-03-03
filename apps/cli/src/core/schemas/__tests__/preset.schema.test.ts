import { describe, it, expect } from 'vitest';
import { PresetSchema } from '../preset.schema.js';

const validPreset = {
  id: 'frontend-web',
  description: '웹 프론트엔드 프로젝트를 위한 프리셋',
  rules: ['typescript', 'react-typescript', 'nextjs'],
};

describe('PresetSchema', () => {
  describe('valid', () => {
    it('전체 필드', () => {
      expect(PresetSchema.parse(validPreset)).toEqual(validPreset);
    });

    it('kebab-case id', () => {
      expect(() => PresetSchema.parse({ ...validPreset, id: 'backend-ts' })).not.toThrow();
    });

    it('단일 rule', () => {
      expect(() => PresetSchema.parse({ ...validPreset, rules: ['typescript'] })).not.toThrow();
    });
  });

  describe('invalid', () => {
    it('빈 rules 배열', () => {
      expect(() => PresetSchema.parse({ ...validPreset, rules: [] })).toThrow();
    });

    it('잘못된 id 패턴 - 숫자로 시작', () => {
      expect(() => PresetSchema.parse({ ...validPreset, id: '1frontend' })).toThrow();
    });

    it('잘못된 id 패턴 - 대문자 포함', () => {
      expect(() => PresetSchema.parse({ ...validPreset, id: 'Frontend' })).toThrow();
    });

    it('잘못된 id 패턴 - 언더스코어 포함', () => {
      expect(() => PresetSchema.parse({ ...validPreset, id: 'front_end' })).toThrow();
    });

    it('빈 description', () => {
      expect(() => PresetSchema.parse({ ...validPreset, description: '' })).toThrow();
    });

    it('unknown 필드', () => {
      expect(() => PresetSchema.parse({ ...validPreset, extra: 'field' })).toThrow();
    });

    it('rules 항목 빈 문자열', () => {
      expect(() => PresetSchema.parse({ ...validPreset, rules: ['typescript', ''] })).toThrow();
    });
  });
});
