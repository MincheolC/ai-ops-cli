import { describe, it, expect } from 'vitest';
import { ManifestSchema, SCOPES } from '../manifest.schema.js';

const validManifest = {
  tools: ['cursor', 'claude'],
  scope: 'project' as const,
  installed_rules: ['typescript-naming', 'react-hooks'],
  sourceHash: 'a1b2c3',
  generatedAt: '2024-01-01T00:00:00Z',
};

describe('ManifestSchema', () => {
  describe('valid', () => {
    it('project scope (UTC)', () => {
      expect(ManifestSchema.parse(validManifest)).toEqual(validManifest);
    });

    it('global scope', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, scope: 'global' })).not.toThrow();
    });

    it('offset datetime (+09:00)', () => {
      expect(() =>
        ManifestSchema.parse({
          ...validManifest,
          generatedAt: '2024-01-01T09:00:00+09:00',
        }),
      ).not.toThrow();
    });

    it('installed_rules 빈 배열 허용', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, installed_rules: [] })).not.toThrow();
    });

    it('preset optional 필드 포함', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, preset: 'frontend-web' })).not.toThrow();
    });

    it('preset 생략', () => {
      expect(() => ManifestSchema.parse(validManifest)).not.toThrow();
    });

    it('workspaces optional 포함', () => {
      expect(() =>
        ManifestSchema.parse({
          ...validManifest,
          workspaces: {
            'apps/web': { preset: 'frontend-web', rules: ['typescript', 'nextjs'] },
            'services/api': { preset: 'backend-ts', rules: ['typescript', 'nestjs'] },
          },
        }),
      ).not.toThrow();
    });

    it('workspaces 생략', () => {
      expect(() => ManifestSchema.parse(validManifest)).not.toThrow();
    });
  });

  describe('invalid', () => {
    it('미지원 scope', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, scope: 'workspace' })).toThrow();
    });

    it('sourceHash 대문자', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, sourceHash: 'A1B2C3' })).toThrow();
    });

    it('sourceHash 5자리 (짧음)', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, sourceHash: 'a1b2c' })).toThrow();
    });

    it('sourceHash 7자리 (김)', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, sourceHash: 'a1b2c34' })).toThrow();
    });

    it('sourceHash 비hex 문자', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, sourceHash: 'zzzzzz' })).toThrow();
    });

    it('비ISO datetime (날짜만)', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, generatedAt: '2024-01-01' })).toThrow();
    });

    it('비ISO datetime (임의 문자열)', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, generatedAt: 'not-a-date' })).toThrow();
    });

    it('필수 필드 누락 (tools)', () => {
      const { tools: _t, ...rest } = validManifest;
      expect(() => ManifestSchema.parse(rest)).toThrow();
    });

    it('tools 빈 배열', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, tools: [] })).toThrow();
    });

    it('필수 필드 누락 (sourceHash)', () => {
      const { sourceHash: _h, ...rest } = validManifest;
      expect(() => ManifestSchema.parse(rest)).toThrow();
    });

    it('필수 필드 누락 (generatedAt)', () => {
      const { generatedAt: _g, ...rest } = validManifest;
      expect(() => ManifestSchema.parse(rest)).toThrow();
    });

    it('unknown 필드', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, extra: 'field' })).toThrow();
    });

    it('preset 빈 문자열', () => {
      expect(() => ManifestSchema.parse({ ...validManifest, preset: '' })).toThrow();
    });
  });
});

describe('SCOPES', () => {
  it('PROJECT/GLOBAL 상수 값 확인', () => {
    expect(SCOPES.PROJECT).toBe('project');
    expect(SCOPES.GLOBAL).toBe('global');
  });
});
