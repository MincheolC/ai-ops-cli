import { describe, it, expect } from 'vitest';
import { ProfileSchema } from '../profile.schema.js';

const validProfile = {
  id: 'claude',
  output: {
    format: 'markdown' as const,
    files: [
      {
        path: '.claude/rules/typescript.md',
        sections: ['constraints', 'guidelines'],
      },
    ],
  },
  include_rules: ['typescript-naming', 'typescript-types'],
  quality_gate: {
    enabled: true,
    checklist: ['All exports have return types', 'No any usage'],
  },
};

describe('ProfileSchema', () => {
  describe('valid', () => {
    it('전체 필드', () => {
      expect(ProfileSchema.parse(validProfile)).toEqual(validProfile);
    });

    it('quality_gate 생략', () => {
      const { quality_gate: _qg, ...rest } = validProfile;
      expect(() => ProfileSchema.parse(rest)).not.toThrow();
    });

    it('sections 생략 (split_by 사용)', () => {
      const input = {
        ...validProfile,
        output: {
          ...validProfile.output,
          files: [{ path: 'rules/{category}.mdc', split_by: 'category' }],
        },
      };
      expect(() => ProfileSchema.parse(input)).not.toThrow();
    });

    it('sections/split_by 혼합 (여러 파일)', () => {
      const input = {
        ...validProfile,
        output: {
          format: 'markdown' as const,
          files: [
            { path: 'rules/all.mdc', sections: ['constraints'] },
            { path: 'rules/{category}.mdc', split_by: 'category' },
          ],
        },
      };
      expect(() => ProfileSchema.parse(input)).not.toThrow();
    });

    it('sections/split_by 모두 생략된 파일', () => {
      const input = {
        ...validProfile,
        output: {
          ...validProfile.output,
          files: [{ path: 'rules/all.mdc' }],
        },
      };
      expect(() => ProfileSchema.parse(input)).not.toThrow();
    });
  });

  describe('invalid', () => {
    it('미지원 format', () => {
      expect(() =>
        ProfileSchema.parse({
          ...validProfile,
          output: { ...validProfile.output, format: 'html' },
        }),
      ).toThrow();
    });

    it('files 빈 배열', () => {
      expect(() =>
        ProfileSchema.parse({
          ...validProfile,
          output: { ...validProfile.output, files: [] },
        }),
      ).toThrow();
    });

    it('include_rules 빈 배열', () => {
      expect(() => ProfileSchema.parse({ ...validProfile, include_rules: [] })).toThrow();
    });

    it('필수 필드 누락 (id)', () => {
      const { id: _id, ...rest } = validProfile;
      expect(() => ProfileSchema.parse(rest)).toThrow();
    });

    it('필수 필드 누락 (output)', () => {
      const { output: _o, ...rest } = validProfile;
      expect(() => ProfileSchema.parse(rest)).toThrow();
    });

    it('file.path 빈 문자열', () => {
      expect(() =>
        ProfileSchema.parse({
          ...validProfile,
          output: {
            ...validProfile.output,
            files: [{ path: '' }],
          },
        }),
      ).toThrow();
    });

    it('quality_gate.checklist 빈 문자열 포함', () => {
      expect(() =>
        ProfileSchema.parse({
          ...validProfile,
          quality_gate: { enabled: true, checklist: [''] },
        }),
      ).toThrow();
    });

    it('unknown 필드 (root)', () => {
      expect(() => ProfileSchema.parse({ ...validProfile, extra: 'field' })).toThrow();
    });

    it('unknown 필드 (output)', () => {
      expect(() =>
        ProfileSchema.parse({
          ...validProfile,
          output: { ...validProfile.output, extra: true },
        }),
      ).toThrow();
    });
  });
});
