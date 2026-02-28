import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage']);

const isVisibleDir = (basePath: string, name: string): boolean => {
  if (name.startsWith('.') || EXCLUDE_DIRS.has(name)) return false;
  return statSync(resolve(basePath, name)).isDirectory();
};

// Project manifest files that indicate a workspace root
const PROJECT_MANIFESTS = [
  'package.json', // Node.js / JS / TS
  'pubspec.yaml', // Flutter / Dart
  'pyproject.toml', // Python (modern)
  'setup.py', // Python (legacy)
  'Cargo.toml', // Rust
  'go.mod', // Go
];

const isWorkspaceRoot = (dirPath: string): boolean => PROJECT_MANIFESTS.some((f) => existsSync(join(dirPath, f)));

// 프로젝트 매니페스트 파일 존재 여부로 워크스페이스 판별:
// 1. top-level dir에 매니페스트 → 그 자체가 워크스페이스 (e.g. backend-ts, mobile, web)
// 2. top-level dir에 매니페스트 없고 자식에 있음 → 자식을 후보로 (e.g. apps/web, packages/ui)
// 3. 매니페스트 없는 경우 → 1-depth 그대로
export const listWorkspaceCandidates = (basePath: string): string[] => {
  const topLevel = readdirSync(basePath).filter((name) => isVisibleDir(basePath, name));

  const candidates: string[] = [];
  for (const dir of topLevel) {
    const subPath = resolve(basePath, dir);
    if (isWorkspaceRoot(subPath)) {
      candidates.push(dir);
    } else {
      const children = readdirSync(subPath).filter((name) => isVisibleDir(subPath, name));
      const wsChildren = children.filter((name) => isWorkspaceRoot(resolve(subPath, name)));
      if (wsChildren.length > 0) {
        for (const child of wsChildren) {
          candidates.push(join(dir, child));
        }
      } else {
        candidates.push(dir);
      }
    }
  }

  return candidates.sort();
};
