import { describe, it, expect } from 'vitest';
import {
  wrapWithHeader,
  isManagedFile,
  parseManagedHeader,
  stripManagedHeader,
  wrapWithSection,
  hasAiOpsSection,
  stripAiOpsSection,
  replaceAiOpsSection,
} from '../managed-header.js';

const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-27T00:00:00.000Z' };

describe('wrapWithHeader', () => {
  it('produces marker + meta + blank line + content', () => {
    const result = wrapWithHeader('# Hello', META);
    const lines = result.split('\n');
    expect(lines[0]).toBe('<!-- managed by ai-ops -->');
    expect(lines[1]).toBe(`<!-- sourceHash: a1b2c3 | generatedAt: 2026-02-27T00:00:00.000Z -->`);
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('# Hello');
  });
});

describe('isManagedFile', () => {
  it('returns true for managed file', () => {
    expect(isManagedFile(wrapWithHeader('content', META))).toBe(true);
  });

  it('returns false for plain content', () => {
    expect(isManagedFile('# Not managed')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isManagedFile('')).toBe(false);
  });
});

describe('parseManagedHeader', () => {
  it('extracts sourceHash and generatedAt', () => {
    const wrapped = wrapWithHeader('body', META);
    expect(parseManagedHeader(wrapped)).toEqual(META);
  });

  it('returns null for non-managed content', () => {
    expect(parseManagedHeader('# plain')).toBeNull();
  });

  it('returns null when meta line format is broken', () => {
    const broken = '<!-- managed by ai-ops -->\nbad meta line\n\ncontent';
    expect(parseManagedHeader(broken)).toBeNull();
  });
});

describe('stripManagedHeader', () => {
  it('removes header and returns content', () => {
    const wrapped = wrapWithHeader('# Rule', META);
    expect(stripManagedHeader(wrapped)).toBe('# Rule');
  });

  it('returns original content for non-managed file', () => {
    const plain = '# Not managed';
    expect(stripManagedHeader(plain)).toBe(plain);
  });

  it('idempotency: wrap → strip = original', () => {
    const original = '# Title\n\nSome content\n- item';
    expect(stripManagedHeader(wrapWithHeader(original, META))).toBe(original);
  });
});

describe('wrapWithSection', () => {
  it('섹션 마커로 콘텐츠 감싸기', () => {
    const result = wrapWithSection('# Rules', META);
    expect(result).toContain('<!-- ai-ops:start -->');
    expect(result).toContain('<!-- ai-ops:end -->');
    expect(result).toContain('<!-- sourceHash: a1b2c3 | generatedAt: 2026-02-27T00:00:00.000Z -->');
    expect(result).toContain('# Rules');
  });

  it('start 이전에 meta line이 위치', () => {
    const result = wrapWithSection('content', META);
    const lines = result.split('\n');
    expect(lines[0]).toBe('<!-- ai-ops:start -->');
    expect(lines[1]).toContain('sourceHash');
  });
});

describe('hasAiOpsSection', () => {
  it('섹션 마커 있으면 true', () => {
    const content = `# User\n\n${wrapWithSection('rules', META)}\n`;
    expect(hasAiOpsSection(content)).toBe(true);
  });

  it('마커 없으면 false', () => {
    expect(hasAiOpsSection('# plain content')).toBe(false);
  });

  it('start만 있고 end 없으면 false', () => {
    expect(hasAiOpsSection('<!-- ai-ops:start -->\norphan')).toBe(false);
  });
});

describe('stripAiOpsSection', () => {
  it('섹션 제거 후 사용자 콘텐츠 보존', () => {
    const userContent = '# User content\n\nSome text';
    const full = userContent + '\n\n' + wrapWithSection('# rules', META) + '\n';
    const result = stripAiOpsSection(full);
    expect(result).toContain('# User content');
    expect(result).not.toContain('<!-- ai-ops:start -->');
    expect(result).not.toContain('<!-- ai-ops:end -->');
    expect(result).not.toContain('# rules');
  });

  it('마커 없으면 원본 반환', () => {
    const plain = '# plain';
    expect(stripAiOpsSection(plain)).toBe(plain);
  });

  it('섹션만 있을 때 빈 내용이 아닌 줄바꿈 포함 문자열 반환', () => {
    const sectionOnly = wrapWithSection('rules', META);
    const result = stripAiOpsSection(sectionOnly);
    expect(result).not.toContain('<!-- ai-ops:start -->');
  });
});

describe('replaceAiOpsSection', () => {
  it('기존 섹션을 새 섹션으로 교체', () => {
    const userContent = '# User';
    const oldSection = wrapWithSection('old rules', META);
    const full = userContent + '\n\n' + oldSection + '\n';

    const META2 = { sourceHash: 'ff1122', generatedAt: '2026-03-01T00:00:00.000Z' };
    const newSection = wrapWithSection('new rules', META2);
    const result = replaceAiOpsSection(full, newSection);

    expect(result).toContain('# User');
    expect(result).toContain('new rules');
    expect(result).not.toContain('old rules');
    expect(result.split('<!-- ai-ops:start -->').length - 1).toBe(1);
  });

  it('마커 없으면 원본 반환', () => {
    const plain = '# plain';
    expect(replaceAiOpsSection(plain, wrapWithSection('new', META))).toBe(plain);
  });
});
