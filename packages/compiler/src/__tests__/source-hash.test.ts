import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHash, computeSourceHash, buildManifest } from '../source-hash.js';
import { ManifestSchema } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesDir = resolve(__dirname, '../../data/rules');

afterEach(() => {
  vi.useRealTimers();
});

describe('computeHash', () => {
  it('동일 입력 → 동일 출력 (determinism)', () => {
    expect(computeHash(['a', 'b'])).toBe(computeHash(['a', 'b']));
  });

  it('6자리 hex 정규식 매칭', () => {
    expect(computeHash(['test'])).toMatch(/^[a-f0-9]{6}$/);
  });

  it('순서 다르면 다른 해시', () => {
    expect(computeHash(['a', 'b'])).not.toBe(computeHash(['b', 'a']));
  });

  it('빈 배열 → 유효 해시', () => {
    expect(computeHash([])).toMatch(/^[a-f0-9]{6}$/);
  });
});

describe('computeSourceHash', () => {
  it('실제 data/rules/ 대상 2회 호출 동일 결과', () => {
    expect(computeSourceHash(rulesDir)).toBe(computeSourceHash(rulesDir));
  });
});

describe('buildManifest', () => {
  it('정상 생성, ManifestSchema 통과', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      preset: 'frontend-web',
      installedRules: ['typescript', 'react-typescript'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.generatedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('preset 생략 시 optional 처리', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.preset).toBeUndefined();
  });

  it('workspaces 포함 시 ManifestSchema 통과', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code', 'codex'],
      scope: 'project',
      workspaces: {
        'apps/web': { preset: 'frontend-web', rules: ['typescript', 'nextjs'] },
        'services/api': { preset: 'backend-ts', rules: ['typescript', 'nestjs'] },
      },
      installedRules: ['typescript', 'nextjs', 'nestjs'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.workspaces?.['apps/web']?.preset).toBe('frontend-web');
  });

  it('installedFiles 포함 시 installed_files 필드 저장', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      installedFiles: ['.claude/rules/typescript.md'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.installed_files).toEqual(['.claude/rules/typescript.md']);
  });

  it('installedFiles 생략 시 installed_files undefined', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      sourceHash: 'abc123',
    });

    expect(manifest.installed_files).toBeUndefined();
  });
});
