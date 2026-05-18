import { afterEach, describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  resolveCompilerDataDir,
  resolveSkillsDir,
  resolveReferenceSkillsDir,
  resolveTaskSkillsDir,
  resolveSkillCatalogPath,
  resolveBasePath,
  resolveUserBasePath,
} from '../lib/paths.js';

const ORIGINAL_AI_OPS_HOME = process.env.AI_OPS_HOME;
const ORIGINAL_HOME = process.env.HOME;

afterEach(() => {
  if (ORIGINAL_AI_OPS_HOME === undefined) {
    delete process.env.AI_OPS_HOME;
  } else {
    process.env.AI_OPS_HOME = ORIGINAL_AI_OPS_HOME;
  }

  if (ORIGINAL_HOME === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = ORIGINAL_HOME;
  }
});

describe('resolveCompilerDataDir', () => {
  it('data/ 디렉토리가 실제 존재', () => {
    expect(existsSync(resolveCompilerDataDir())).toBe(true);
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
});

describe('resolveBasePath', () => {
  it('project-only → process.cwd()', () => {
    expect(resolveBasePath()).toBe(process.cwd());
  });
});

describe('resolveUserBasePath', () => {
  it('AI_OPS_HOME이 있으면 우선 사용한다', () => {
    process.env.AI_OPS_HOME = '/tmp/ai-ops-home';
    process.env.HOME = '/tmp/home';

    expect(resolveUserBasePath()).toBe('/tmp/ai-ops-home');
  });

  it('AI_OPS_HOME이 없으면 HOME을 사용한다', () => {
    delete process.env.AI_OPS_HOME;
    process.env.HOME = '/tmp/home';

    expect(resolveUserBasePath()).toBe('/tmp/home');
  });

  it('AI_OPS_HOME과 HOME이 모두 없으면 cwd fallback 대신 실패한다', () => {
    delete process.env.AI_OPS_HOME;
    delete process.env.HOME;

    expect(() => resolveUserBasePath()).toThrow('AI_OPS_HOME or HOME is required for global asset commands');
  });
});
