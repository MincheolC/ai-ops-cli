import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isManagedFile } from '@ai-ops/compiler';
import type { FileAction } from '@ai-ops/compiler';

export type InstallResult = {
  written: string[];
  skipped: string[]; // 기존 파일이 managed가 아닌 경우 (사용자 파일 보호)
};

export const installFiles = (basePath: string, actions: readonly FileAction[]): InstallResult => {
  const written: string[] = [];
  const skipped: string[] = [];

  for (const action of actions) {
    const absPath = resolve(basePath, action.relativePath);

    if (existsSync(absPath)) {
      const existing = readFileSync(absPath, 'utf-8');
      if (!isManagedFile(existing)) {
        skipped.push(action.relativePath);
        continue;
      }
    }

    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, action.content, 'utf-8');
    written.push(action.relativePath);
  }

  return { written, skipped };
};
