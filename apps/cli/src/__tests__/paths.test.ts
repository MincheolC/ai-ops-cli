import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  resolveCompilerDataDir,
  resolveRulesDir,
  resolveSkillsDir,
  resolveReferenceSkillsDir,
  resolveTaskSkillsDir,
  resolveSkillCatalogPath,
  resolvePresetsPath,
  resolveBasePath,
} from '../lib/paths.js';

describe('resolveCompilerDataDir', () => {
  it('data/ 디렉토리가 실제 존재', () => {
    expect(existsSync(resolveCompilerDataDir())).toBe(true);
  });

  it('data/rules/ 포함', () => {
    expect(existsSync(resolveRulesDir())).toBe(true);
  });

  it('data/skills/ 포함', () => {
    expect(existsSync(resolveSkillsDir())).toBe(true);
  });

  it('reference-skills/ 포함', () => {
    expect(existsSync(resolveReferenceSkillsDir())).toBe(true);
  });

  it('task-skills/ 포함', () => {
    expect(existsSync(resolveTaskSkillsDir())).toBe(true);
  });

  it('skill-registry.json 포함', () => {
    expect(existsSync(resolveSkillCatalogPath())).toBe(true);
  });

  it('data/presets.yaml 포함', () => {
    expect(existsSync(resolvePresetsPath())).toBe(true);
  });
});

describe('resolveBasePath', () => {
  it('project-only → process.cwd()', () => {
    expect(resolveBasePath()).toBe(process.cwd());
  });
});
