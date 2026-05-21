import { describe, it, expect } from 'vitest';
import {
  hasLegacyHeader,
  parseAiOpsMeta,
  wrapWithSection,
  hasAiOpsSection,
  stripAiOpsSection,
  replaceAiOpsSection,
} from '../../features/project-layer/managed-header.js';

const META = { sourceHash: 'a1b2c3', generatedAt: '2026-02-27T00:00:00.000Z' };

describe('hasLegacyHeader', () => {
  it('managed by ai-ops 마커 포함 시 true', () => {
    expect(hasLegacyHeader('<!-- managed by ai-ops -->\n# content')).toBe(true);
  });

  it('파일 중간에 마커가 있어도 true', () => {
    expect(hasLegacyHeader('# User\n\n<!-- managed by ai-ops -->\n# content')).toBe(true);
  });

  it('마커 없으면 false', () => {
    expect(hasLegacyHeader('# Not managed')).toBe(false);
  });

  it('빈 문자열 → false', () => {
    expect(hasLegacyHeader('')).toBe(false);
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

  it('섹션만 있을 때 trim 후 빈 문자열', () => {
    const sectionOnly = wrapWithSection('rules', META);
    const result = stripAiOpsSection(sectionOnly);
    expect(result).not.toContain('<!-- ai-ops:start -->');
    expect(result.trim()).toBe('');
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

  it('before가 빈 경우 선행 빈 줄 없이 반환', () => {
    const sectionOnly = wrapWithSection('old', META);
    const META2 = { sourceHash: 'ff1122', generatedAt: '2026-03-01T00:00:00.000Z' };
    const newSection = wrapWithSection('new', META2);
    const result = replaceAiOpsSection(sectionOnly, newSection);
    expect(result.startsWith('\n')).toBe(false);
    expect(result).toContain('new');
    expect(result).not.toContain('old');
  });

  it('idempotency: section-only 파일에 동일 섹션 교체 → 내용 동일', () => {
    const sectionOnly = wrapWithSection('content', META) + '\n';
    const result = replaceAiOpsSection(sectionOnly, wrapWithSection('content', META));
    expect(result).toBe(sectionOnly);
  });
});

describe('parseAiOpsMeta', () => {
  it('섹션 내 sourceHash/generatedAt 추출', () => {
    const section = wrapWithSection('# Rules', META);
    expect(parseAiOpsMeta(section)).toEqual(META);
  });

  it('파일 앞에 사용자 콘텐츠가 있어도 추출 가능', () => {
    const full = '# User\n\n' + wrapWithSection('rules', META);
    expect(parseAiOpsMeta(full)).toEqual(META);
  });

  it('섹션 없으면 null', () => {
    expect(parseAiOpsMeta('# plain content')).toBeNull();
  });

  it('meta line 형식이 잘못되면 null', () => {
    const broken = '<!-- ai-ops:start -->\nbad meta line\n\ncontent\n<!-- ai-ops:end -->';
    expect(parseAiOpsMeta(broken)).toBeNull();
  });
});
