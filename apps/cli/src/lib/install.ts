import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  isManagedFile,
  hasAiOpsSection,
  wrapWithSection,
  replaceAiOpsSection,
  stripManagedHeader,
} from 'ai-ops-compiler';
import type { FileAction } from 'ai-ops-compiler';

export type InstallResult = {
  written: string[];
  appended: string[]; // 기존 non-managed 파일에 섹션 추가됨
  skipped: string[]; // 더 이상 발생하지 않음 (하위 호환용)
};

export const installFiles = (
  basePath: string,
  actions: readonly FileAction[],
  meta: { sourceHash: string; generatedAt: string },
): InstallResult => {
  const written: string[] = [];
  const appended: string[] = [];
  const skipped: string[] = [];

  for (const action of actions) {
    const absPath = resolve(basePath, action.relativePath);

    if (existsSync(absPath)) {
      const existing = readFileSync(absPath, 'utf-8');

      if (isManagedFile(existing)) {
        writeFileSync(absPath, action.content, 'utf-8');
        written.push(action.relativePath);
      } else if (hasAiOpsSection(existing)) {
        // 이전에 append된 파일 → 섹션만 교체
        const sectionContent = wrapWithSection(stripManagedHeader(action.content), meta);
        const updated = replaceAiOpsSection(existing, sectionContent);
        writeFileSync(absPath, updated, 'utf-8');
        appended.push(action.relativePath);
      } else {
        // non-managed, 섹션 없음 → 최초 append
        const sectionContent = wrapWithSection(stripManagedHeader(action.content), meta);
        const updated = existing.trimEnd() + '\n\n' + sectionContent + '\n';
        writeFileSync(absPath, updated, 'utf-8');
        appended.push(action.relativePath);
      }
    } else {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, action.content, 'utf-8');
      written.push(action.relativePath);
    }
  }

  return { written, appended, skipped };
};
