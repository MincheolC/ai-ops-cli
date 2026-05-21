import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SkillPackage } from './renderer.js';

export const installSkillPackages = (basePath: string, packages: readonly SkillPackage[]): string[] => {
  const writtenRoots: string[] = [];

  for (const skillPackage of packages) {
    const absRoot = resolve(basePath, skillPackage.rootDir);
    if (existsSync(absRoot)) {
      rmSync(absRoot, { recursive: true, force: true });
    }

    for (const file of skillPackage.files) {
      const absPath = resolve(basePath, file.relativePath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, file.content + '\n', 'utf-8');
    }

    writtenRoots.push(skillPackage.rootDir);
  }

  return writtenRoots;
};

export const removeDirectories = (basePath: string, relativeDirs: readonly string[]): string[] => {
  const removed: string[] = [];

  for (const relativeDir of relativeDirs) {
    const absPath = resolve(basePath, relativeDir);
    if (!existsSync(absPath)) continue;
    rmSync(absPath, { recursive: true, force: true });
    removed.push(relativeDir);
  }

  return removed;
};
