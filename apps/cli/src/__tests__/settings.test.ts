import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installClaudeSettings, uninstallClaudeSettings } from '../lib/claude-settings.js';
import { installGeminiSettings, uninstallGeminiSettings } from '../lib/gemini-settings.js';

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'settings-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe('installClaudeSettings', () => {
  it('빈 디렉토리 — 파일 생성 및 선택된 patch 반영', () => {
    const { dir, cleanup } = setup();
    try {
      installClaudeSettings(dir, ['model']);
      const content = JSON.parse(readFileSync(join(dir, '.claude/settings.local.json'), 'utf-8'));
      expect(content.model).toBe('opusplan');
    } finally {
      cleanup();
    }
  });

  it('기존 파일 있을 때 — deepMerge (기존 키 보존)', () => {
    const { dir, cleanup } = setup();
    try {
      mkdirSync(join(dir, '.claude'), { recursive: true });
      writeFileSync(join(dir, '.claude/settings.local.json'), JSON.stringify({ existingKey: 'kept' }), 'utf-8');
      installClaudeSettings(dir, ['model']);
      const content = JSON.parse(readFileSync(join(dir, '.claude/settings.local.json'), 'utf-8'));
      expect(content.existingKey).toBe('kept');
      expect(content.model).toBe('opusplan');
    } finally {
      cleanup();
    }
  });

  it('빈 배열 — no-op (파일 미생성)', () => {
    const { dir, cleanup } = setup();
    try {
      installClaudeSettings(dir, []);
      expect(existsSync(join(dir, '.claude/settings.local.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('uninstallClaudeSettings', () => {
  it('선택된 키 제거 — cleaned', () => {
    const { dir, cleanup } = setup();
    try {
      installClaudeSettings(dir, ['model', 'plansDirectory']);
      const status = uninstallClaudeSettings(dir, ['model']);
      expect(status).toBe('cleaned');
      const content = JSON.parse(readFileSync(join(dir, '.claude/settings.local.json'), 'utf-8'));
      expect(content.model).toBeUndefined();
      expect(content.plansDirectory).toBe('./.claude/plans');
    } finally {
      cleanup();
    }
  });

  it('전체 제거 — deleted', () => {
    const { dir, cleanup } = setup();
    try {
      installClaudeSettings(dir, ['model']);
      const status = uninstallClaudeSettings(dir, ['model']);
      expect(status).toBe('deleted');
      expect(existsSync(join(dir, '.claude/settings.local.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('파일 없음 — notFound', () => {
    const { dir, cleanup } = setup();
    try {
      const status = uninstallClaudeSettings(dir, ['model']);
      expect(status).toBe('notFound');
    } finally {
      cleanup();
    }
  });
});

describe('installGeminiSettings', () => {
  it('빈 디렉토리 — 파일 생성 및 선택된 patch 반영', () => {
    const { dir, cleanup } = setup();
    try {
      installGeminiSettings(dir, ['ui']);
      const content = JSON.parse(readFileSync(join(dir, '.gemini/settings.json'), 'utf-8'));
      expect(content.ui?.showLineNumbers).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('기존 파일 있을 때 — deepMerge (기존 키 보존)', () => {
    const { dir, cleanup } = setup();
    try {
      mkdirSync(join(dir, '.gemini'), { recursive: true });
      writeFileSync(join(dir, '.gemini/settings.json'), JSON.stringify({ existingKey: 'kept' }), 'utf-8');
      installGeminiSettings(dir, ['ui']);
      const content = JSON.parse(readFileSync(join(dir, '.gemini/settings.json'), 'utf-8'));
      expect(content.existingKey).toBe('kept');
      expect(content.ui?.showLineNumbers).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('빈 배열 — no-op (파일 미생성)', () => {
    const { dir, cleanup } = setup();
    try {
      installGeminiSettings(dir, []);
      expect(existsSync(join(dir, '.gemini/settings.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('uninstallGeminiSettings', () => {
  it('선택된 키 제거 — cleaned', () => {
    const { dir, cleanup } = setup();
    try {
      installGeminiSettings(dir, ['ui', 'plan']);
      const status = uninstallGeminiSettings(dir, ['ui']);
      expect(status).toBe('cleaned');
      const content = JSON.parse(readFileSync(join(dir, '.gemini/settings.json'), 'utf-8'));
      expect(content.ui).toBeUndefined();
      expect(content.general?.plan).toBeDefined();
    } finally {
      cleanup();
    }
  });

  it('전체 제거 — deleted', () => {
    const { dir, cleanup } = setup();
    try {
      installGeminiSettings(dir, ['ui']);
      const status = uninstallGeminiSettings(dir, ['ui']);
      expect(status).toBe('deleted');
      expect(existsSync(join(dir, '.gemini/settings.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('파일 없음 — notFound', () => {
    const { dir, cleanup } = setup();
    try {
      const status = uninstallGeminiSettings(dir, ['ui']);
      expect(status).toBe('notFound');
    } finally {
      cleanup();
    }
  });
});
