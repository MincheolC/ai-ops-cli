import { existsSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { isManagedFile } from 'ai-ops-compiler';

export type UninstallResult = {
  deleted: string[];
  skipped: string[]; // non-managed 파일 (사용자 파일 보호)
  notFound: string[]; // 이미 삭제됨
};

export const removeFiles = (basePath: string, relativePaths: readonly string[]): UninstallResult => {
  const deleted: string[] = [];
  const skipped: string[] = [];
  const notFound: string[] = [];

  for (const rel of relativePaths) {
    const absPath = resolve(basePath, rel);

    if (!existsSync(absPath)) {
      notFound.push(rel);
      continue;
    }

    const content = readFileSync(absPath, 'utf-8');
    if (!isManagedFile(content)) {
      skipped.push(rel);
      continue;
    }

    rmSync(absPath);
    deleted.push(rel);
  }

  return { deleted, skipped, notFound };
};

/** 대상 디렉토리가 비어 있으면 삭제하고, 삭제한 경로 배열 반환 */
export const cleanEmptyDirs = (basePath: string, dirs: readonly string[]): string[] => {
  const removed: string[] = [];

  for (const dir of dirs) {
    const absDir = resolve(basePath, dir);
    if (!existsSync(absDir)) continue;

    try {
      const entries = readdirSync(absDir);
      if (entries.length === 0) {
        rmSync(absDir, { recursive: true });
        removed.push(dir);
      }
    } catch {
      // 삭제 실패는 무시
    }
  }

  return removed;
};

/** manifest의 installed_files에서 정리 대상 디렉토리 목록 추출 */
export const collectManagedDirs = (relativePaths: readonly string[]): string[] => {
  const dirs = new Set<string>();
  for (const rel of relativePaths) {
    const dir = dirname(rel);
    if (dir !== '.') {
      dirs.add(dir);
    }
  }
  return [...dirs];
};
