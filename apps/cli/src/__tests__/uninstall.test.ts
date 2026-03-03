import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { wrapWithHeader, wrapWithSection } from '@/core/index.js';
import { removeFiles, cleanEmptyDirs, collectManagedDirs } from '../lib/uninstall.js';

const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-28T00:00:00.000Z' };

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'uninstall-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

const writeManaged = (dir: string, rel: string): void => {
  const absPath = join(dir, rel);
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(absPath, wrapWithHeader('# content', META), 'utf-8');
};

const writeUser = (dir: string, rel: string): void => {
  const absPath = join(dir, rel);
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(absPath, '# User content', 'utf-8');
};

describe('removeFiles', () => {
  it('managed 파일 삭제 → deleted', () => {
    const { dir, cleanup } = setup();
    try {
      writeManaged(dir, '.claude/rules/typescript.md');
      const result = removeFiles(dir, ['.claude/rules/typescript.md']);
      expect(result.deleted).toEqual(['.claude/rules/typescript.md']);
      expect(result.cleaned).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
      expect(existsSync(join(dir, '.claude/rules/typescript.md'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('non-managed 파일 → skipped (보호)', () => {
    const { dir, cleanup } = setup();
    try {
      writeUser(dir, '.codex/AGENTS.md');
      const result = removeFiles(dir, ['.codex/AGENTS.md']);
      expect(result.skipped).toEqual(['.codex/AGENTS.md']);
      expect(result.deleted).toHaveLength(0);
      expect(result.cleaned).toHaveLength(0);
      expect(existsSync(join(dir, '.codex/AGENTS.md'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('append된 파일 (ai-ops 섹션 포함) → 섹션만 제거, 사용자 내용 보존', () => {
    const { dir, cleanup } = setup();
    const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-28T00:00:00.000Z' };
    try {
      const absPath = join(dir, 'AGENTS.md');
      const section = wrapWithSection('# ai-ops rules', META);
      writeFileSync(absPath, `# User content\n\n${section}\n`, 'utf-8');

      const result = removeFiles(dir, ['AGENTS.md']);
      expect(result.cleaned).toEqual(['AGENTS.md']);
      expect(result.deleted).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
      expect(existsSync(absPath)).toBe(true);

      const content = readFileSync(absPath, 'utf-8');
      expect(content).toContain('# User content');
      expect(content).not.toContain('<!-- ai-ops:start -->');
      expect(content).not.toContain('<!-- ai-ops:end -->');
    } finally {
      cleanup();
    }
  });

  it('존재하지 않는 파일 → notFound', () => {
    const { dir, cleanup } = setup();
    try {
      const result = removeFiles(dir, ['.gemini/GEMINI.md']);
      expect(result.notFound).toEqual(['.gemini/GEMINI.md']);
      expect(result.deleted).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('복합: managed + non-managed + notFound', () => {
    const { dir, cleanup } = setup();
    try {
      writeManaged(dir, '.claude/rules/typescript.md');
      writeUser(dir, '.codex/AGENTS.md');

      const result = removeFiles(dir, ['.claude/rules/typescript.md', '.codex/AGENTS.md', '.gemini/GEMINI.md']);

      expect(result.deleted).toEqual(['.claude/rules/typescript.md']);
      expect(result.skipped).toEqual(['.codex/AGENTS.md']);
      expect(result.notFound).toEqual(['.gemini/GEMINI.md']);
    } finally {
      cleanup();
    }
  });
});

describe('cleanEmptyDirs', () => {
  it('빈 디렉토리 삭제 → removed 반환', () => {
    const { dir, cleanup } = setup();
    try {
      mkdirSync(join(dir, '.claude/rules'), { recursive: true });
      const removed = cleanEmptyDirs(dir, ['.claude/rules']);
      expect(removed).toEqual(['.claude/rules']);
      expect(existsSync(join(dir, '.claude/rules'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('비어있지 않은 디렉토리는 유지', () => {
    const { dir, cleanup } = setup();
    try {
      mkdirSync(join(dir, '.claude/rules'), { recursive: true });
      writeFileSync(join(dir, '.claude/rules/other.md'), '# other', 'utf-8');
      const removed = cleanEmptyDirs(dir, ['.claude/rules']);
      expect(removed).toHaveLength(0);
      expect(existsSync(join(dir, '.claude/rules'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('존재하지 않는 디렉토리 → 건너뜀', () => {
    const { dir, cleanup } = setup();
    try {
      const removed = cleanEmptyDirs(dir, ['.nonexistent/dir']);
      expect(removed).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});

describe('collectManagedDirs', () => {
  it('상대 경로에서 디렉토리 추출', () => {
    const dirs = collectManagedDirs([
      '.claude/rules/typescript.md',
      '.claude/rules/react-typescript.md',
      '.codex/AGENTS.md',
    ]);
    expect(dirs).toContain('.claude/rules');
    expect(dirs).toContain('.codex');
    expect(new Set(dirs).size).toBe(dirs.length); // 중복 없음
  });

  it('루트 파일 (디렉토리 없음) → 제외', () => {
    const dirs = collectManagedDirs(['AGENTS.md', '.claude/rules/typescript.md']);
    expect(dirs).not.toContain('.');
    expect(dirs).toContain('.claude/rules');
  });
});
