import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { resolveCompilerDataDir, resolveRulesDir, resolvePresetsPath, resolveBasePath } from '../lib/paths.js';

describe('resolveCompilerDataDir', () => {
  it('data/ 디렉토리가 실제 존재', () => {
    expect(existsSync(resolveCompilerDataDir())).toBe(true);
  });

  it('data/rules/ 포함', () => {
    expect(existsSync(resolveRulesDir())).toBe(true);
  });

  it('data/presets.yaml 포함', () => {
    expect(existsSync(resolvePresetsPath())).toBe(true);
  });
});

describe('resolveBasePath', () => {
  it('project → process.cwd()', () => {
    expect(resolveBasePath('project')).toBe(process.cwd());
  });

  it('global → ~/.ai-ops/', () => {
    expect(resolveBasePath('global')).toBe(resolve(homedir(), '.ai-ops'));
  });
});
