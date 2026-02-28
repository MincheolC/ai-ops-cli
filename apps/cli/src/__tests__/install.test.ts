import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { wrapWithHeader } from '@ai-ops/compiler';
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
      const result = installFiles(dir, [
        { relativePath: 'rules/typescript.md', content: wrapWithHeader('# TS', META) },
      ]);
      expect(result.written).toEqual(['rules/typescript.md']);
      expect(result.skipped).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('managed 파일 → 덮어쓰기 (written)', () => {
    const { dir, cleanup } = setup();
    try {
      installFiles(dir, [{ relativePath: 'rules/typescript.md', content: wrapWithHeader('old', META) }]);
      const result = installFiles(dir, [{ relativePath: 'rules/typescript.md', content: wrapWithHeader('new', META) }]);
      expect(result.written).toEqual(['rules/typescript.md']);
    } finally {
      cleanup();
    }
  });

  it('non-managed 파일 → skip (skipped)', () => {
    const { dir, cleanup } = setup();
    try {
      writeFileSync(join(dir, 'AGENTS.md'), '# User content', 'utf-8');
      const result = installFiles(dir, [{ relativePath: 'AGENTS.md', content: wrapWithHeader('# ai-ops', META) }]);
      expect(result.skipped).toEqual(['AGENTS.md']);
      expect(result.written).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('중간 디렉토리 자동 생성', () => {
    const { dir, cleanup } = setup();
    try {
      const result = installFiles(dir, [{ relativePath: 'deep/nested/rule.md', content: wrapWithHeader('# R', META) }]);
      expect(result.written).toEqual(['deep/nested/rule.md']);
    } finally {
      cleanup();
    }
  });
});
