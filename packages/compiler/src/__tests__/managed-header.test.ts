import { describe, it, expect } from 'vitest';
import { wrapWithHeader, isManagedFile, parseManagedHeader, stripManagedHeader } from '../managed-header.js';

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
