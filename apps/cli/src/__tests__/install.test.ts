import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { wrapWithHeader } from '@/core/index.js';
import { installFiles } from '../lib/install.js';

const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-27T00:00:00.000Z' };

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'install-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe('installFiles', () => {
  it('새 파일 작성 → written에 포함', () => {
    const { dir, cleanup } = setup();
    try {
      const result = installFiles(
        dir,
        [{ relativePath: 'rules/typescript.md', content: wrapWithHeader('# TS', META) }],
        META,
      );
      expect(result.written).toEqual(['rules/typescript.md']);
      expect(result.appended).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('managed 파일 → 덮어쓰기 (written)', () => {
    const { dir, cleanup } = setup();
    try {
      installFiles(dir, [{ relativePath: 'rules/typescript.md', content: wrapWithHeader('old', META) }], META);
      const result = installFiles(
        dir,
        [{ relativePath: 'rules/typescript.md', content: wrapWithHeader('new', META) }],
        META,
      );
      expect(result.written).toEqual(['rules/typescript.md']);
      expect(result.appended).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('non-managed 파일 → append (섹션 마커 포함)', () => {
    const { dir, cleanup } = setup();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# User content', 'utf-8');
      const result = installFiles(
        dir,
        [{ relativePath: 'AGENTS.md', content: wrapWithHeader('# ai-ops', META) }],
        META,
      );
      expect(result.appended).toEqual(['AGENTS.md']);
      expect(result.written).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);

      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('# User content');
      expect(content).toContain('<!-- ai-ops:start -->');
      expect(content).toContain('<!-- ai-ops:end -->');
      expect(content).toContain('# ai-ops');
    } finally {
      cleanup();
    }
  });

  it('append된 파일 재설치 → 섹션만 교체, 사용자 내용 보존', () => {
    const { dir, cleanup } = setup();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# User content', 'utf-8');
      installFiles(dir, [{ relativePath: 'AGENTS.md', content: wrapWithHeader('# old ai-ops', META) }], META);

      const META2 = { sourceHash: 'ff1122', generatedAt: '2026-03-01T00:00:00.000Z' };
      const result = installFiles(
        dir,
        [{ relativePath: 'AGENTS.md', content: wrapWithHeader('# new ai-ops', META2) }],
        META2,
      );
      expect(result.appended).toEqual(['AGENTS.md']);

      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(content).toContain('# User content');
      expect(content).toContain('# new ai-ops');
      expect(content).not.toContain('# old ai-ops');
      // 섹션 마커는 하나씩만 존재
      expect(content.split('<!-- ai-ops:start -->').length - 1).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('중간 디렉토리 자동 생성', () => {
    const { dir, cleanup } = setup();
    try {
      const result = installFiles(
        dir,
        [{ relativePath: 'deep/nested/rule.md', content: wrapWithHeader('# R', META) }],
        META,
      );
      expect(result.written).toEqual(['deep/nested/rule.md']);
    } finally {
      cleanup();
    }
  });
});
