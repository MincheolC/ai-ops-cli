import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listWorkspaceCandidates } from '../lib/workspace.js';

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-test-'));
  const mkdir = (...parts: string[]) => mkdirSync(join(dir, ...parts), { recursive: true });
  const touch = (...parts: string[]) => writeFileSync(join(dir, ...parts), '{}');
  return { dir, mkdir, touch, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe('listWorkspaceCandidates', () => {
  it('flat: top-level dirs with package.json → 1-depth candidates', () => {
    const { dir, mkdir, touch, cleanup } = setup();
    try {
      mkdir('backend-ts', 'src');
      touch('backend-ts', 'package.json');
      mkdir('web', 'app');
      touch('web', 'package.json');
      mkdir('mobile', 'lib');
      touch('mobile', 'package.json');

      expect(listWorkspaceCandidates(dir)).toEqual(['backend-ts', 'mobile', 'web']);
    } finally {
      cleanup();
    }
  });

  it('grouped: top-level group dir (no package.json) → 2-depth candidates', () => {
    const { dir, mkdir, touch, cleanup } = setup();
    try {
      mkdir('apps', 'web');
      touch('apps', 'web', 'package.json');
      mkdir('apps', 'api');
      touch('apps', 'api', 'package.json');
      mkdir('packages', 'ui');
      touch('packages', 'ui', 'package.json');

      expect(listWorkspaceCandidates(dir)).toEqual(['apps/api', 'apps/web', 'packages/ui']);
    } finally {
      cleanup();
    }
  });

  it('mixed: some top-level have package.json, some are group dirs', () => {
    const { dir, mkdir, touch, cleanup } = setup();
    try {
      mkdir('backend-ts', 'src');
      touch('backend-ts', 'package.json');
      mkdir('apps', 'web');
      touch('apps', 'web', 'package.json');

      expect(listWorkspaceCandidates(dir)).toEqual(['apps/web', 'backend-ts']);
    } finally {
      cleanup();
    }
  });

  it('flutter/python: pubspec.yaml, pyproject.toml으로 판별', () => {
    const { dir, mkdir, touch, cleanup } = setup();
    try {
      mkdir('mobile', 'lib');
      touch('mobile', 'pubspec.yaml');
      mkdir('backend-py', 'src');
      touch('backend-py', 'pyproject.toml');

      expect(listWorkspaceCandidates(dir)).toEqual(['backend-py', 'mobile']);
    } finally {
      cleanup();
    }
  });

  it('node_modules, dist, .git 제외', () => {
    const { dir, mkdir, touch, cleanup } = setup();
    try {
      mkdir('backend-ts');
      touch('backend-ts', 'package.json');
      mkdir('node_modules', 'some-pkg');
      mkdir('dist');
      mkdir('.git');

      expect(listWorkspaceCandidates(dir)).toEqual(['backend-ts']);
    } finally {
      cleanup();
    }
  });
});
