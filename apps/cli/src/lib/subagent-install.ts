import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { SubagentPackage } from '@/core/index.js';

const resolveInsideBasePath = (basePath: string, relativePath: string): string => {
  const absBasePath = resolve(basePath);
  const absPath = resolve(absBasePath, relativePath);
  const fromBase = relative(absBasePath, absPath);

  if (fromBase.length === 0 || fromBase.startsWith('..') || isAbsolute(fromBase)) {
    throw new Error(`Subagent path escapes AI_OPS_HOME: ${relativePath}`);
  }

  return absPath;
};

export const installSubagentPackages = (basePath: string, packages: readonly SubagentPackage[]): string[] => {
  const written: string[] = [];

  for (const subagentPackage of packages) {
    for (const file of subagentPackage.files) {
      const absPath = resolveInsideBasePath(basePath, file.relativePath);
      if (existsSync(absPath)) {
        rmSync(absPath, { recursive: true, force: true });
      }
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, file.content.trimEnd() + '\n', 'utf-8');
      written.push(file.relativePath);
    }
  }

  return written;
};

export const removeSubagentFiles = (basePath: string, relativePaths: readonly string[]): string[] => {
  const removed: string[] = [];

  for (const relativePath of relativePaths) {
    const absPath = resolveInsideBasePath(basePath, relativePath);
    if (!existsSync(absPath)) continue;
    rmSync(absPath, { recursive: true, force: true });
    removed.push(relativePath);
  }

  return removed;
};
