import { describe, it, expect } from 'vitest';
import { computeDiff } from '../diff.js';
import type { Manifest } from '../schemas/index.js';

const makeManifest = (overrides: Partial<Manifest> = {}): Manifest => ({
  tools: ['claude-code'],
  scope: 'project',
  installed_rules: ['typescript', 'react-typescript'],
  sourceHash: 'abc123',
  generatedAt: '2026-02-27T00:00:00.000Z',
  ...overrides,
});

describe('computeDiff', () => {
  it('returns up-to-date when rules and hash match', () => {
    const result = computeDiff({
      previous: makeManifest(),
      currentRules: ['typescript', 'react-typescript'],
      currentSourceHash: 'abc123',
    });
    expect(result.status).toBe('up-to-date');
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.sourceChanged).toBe(false);
    expect(result.versionChanged).toBe(false);
  });

  it('detects added rules', () => {
    const result = computeDiff({
      previous: makeManifest({ installed_rules: ['typescript'] }),
      currentRules: ['typescript', 'nextjs'],
      currentSourceHash: 'abc123',
    });
    expect(result.status).toBe('changed');
    expect(result.added).toEqual(['nextjs']);
    expect(result.removed).toHaveLength(0);
  });

  it('detects removed rules', () => {
    const result = computeDiff({
      previous: makeManifest({ installed_rules: ['typescript', 'react-typescript'] }),
      currentRules: ['typescript'],
      currentSourceHash: 'abc123',
    });
    expect(result.status).toBe('changed');
    expect(result.removed).toEqual(['react-typescript']);
    expect(result.added).toHaveLength(0);
  });

  it('detects sourceChanged with same rules', () => {
    const result = computeDiff({
      previous: makeManifest(),
      currentRules: ['typescript', 'react-typescript'],
      currentSourceHash: 'ffffff',
    });
    expect(result.status).toBe('changed');
    expect(result.sourceChanged).toBe(true);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('detects versionChanged when cliVersion differs', () => {
    const result = computeDiff({
      previous: makeManifest({ cliVersion: '0.1.0' }),
      currentRules: ['typescript', 'react-typescript'],
      currentSourceHash: 'abc123',
      currentCliVersion: '0.2.0',
    });
    expect(result.status).toBe('changed');
    expect(result.versionChanged).toBe(true);
    expect(result.sourceChanged).toBe(false);
  });

  it('does not flag versionChanged when cliVersion is same', () => {
    const result = computeDiff({
      previous: makeManifest({ cliVersion: '0.2.0' }),
      currentRules: ['typescript', 'react-typescript'],
      currentSourceHash: 'abc123',
      currentCliVersion: '0.2.0',
    });
    expect(result.status).toBe('up-to-date');
    expect(result.versionChanged).toBe(false);
  });

  it('does not flag versionChanged for legacy manifest without cliVersion', () => {
    const result = computeDiff({
      previous: makeManifest(),
      currentRules: ['typescript', 'react-typescript'],
      currentSourceHash: 'abc123',
      currentCliVersion: '0.2.0',
    });
    expect(result.status).toBe('up-to-date');
    expect(result.versionChanged).toBe(false);
  });

  it('handles combined added + removed + hash change', () => {
    const result = computeDiff({
      previous: makeManifest({ installed_rules: ['typescript', 'react-typescript'] }),
      currentRules: ['typescript', 'nextjs'],
      currentSourceHash: 'deadbe',
    });
    expect(result.status).toBe('changed');
    expect(result.added).toEqual(['nextjs']);
    expect(result.removed).toEqual(['react-typescript']);
    expect(result.sourceChanged).toBe(true);
  });

  it('treats empty installed_rules as all added', () => {
    const result = computeDiff({
      previous: makeManifest({ installed_rules: [] }),
      currentRules: ['typescript', 'nextjs'],
      currentSourceHash: 'abc123',
    });
    expect(result.added).toEqual(['typescript', 'nextjs']);
    expect(result.removed).toHaveLength(0);
  });

  it('treats empty currentRules as all removed', () => {
    const result = computeDiff({
      previous: makeManifest({ installed_rules: ['typescript', 'react-typescript'] }),
      currentRules: [],
      currentSourceHash: 'abc123',
    });
    expect(result.removed).toEqual(['typescript', 'react-typescript']);
    expect(result.added).toHaveLength(0);
  });
});
