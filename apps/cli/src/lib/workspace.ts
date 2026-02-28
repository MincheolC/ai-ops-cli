import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage']);

const isVisibleDir = (basePath: string, name: string): boolean => {
  if (name.startsWith('.') || EXCLUDE_DIRS.has(name)) return false;
  return statSync(resolve(basePath, name)).isDirectory();
};

// basePath 하위 2-depth 디렉토리 탐색 → 워크스페이스 후보 반환
// e.g. "apps/web", "services/api"
// 2-depth 자식이 없는 경우 1-depth 디렉토리 자체를 후보로 포함
export const listWorkspaceCandidates = (basePath: string): string[] => {
  const topLevel = readdirSync(basePath).filter((name) => isVisibleDir(basePath, name));

  const candidates: string[] = [];
  for (const dir of topLevel) {
    const subPath = resolve(basePath, dir);
    const children = readdirSync(subPath).filter((name) => isVisibleDir(subPath, name));
    if (children.length > 0) {
      for (const child of children) {
        candidates.push(join(dir, child));
      }
    } else {
      candidates.push(dir);
    }
  }

  return candidates.sort();
};
