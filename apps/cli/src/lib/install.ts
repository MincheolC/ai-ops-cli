import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  hasAiOpsSection,
  replaceAiOpsSection,
  stripAiOpsSection,
  hasLegacyHeader,
} from '@/core/index.js';
import type { FileAction } from '@/core/index.js';

export type InstallResult = {
  written: string[];
  appended: string[]; // 기존 non-managed 파일에 섹션 추가됨
  skipped: string[]; // 더 이상 발생하지 않음 (하위 호환용)
};

export const installFiles = (
  basePath: string,
  actions: readonly FileAction[],
  _meta: { sourceHash: string; generatedAt: string },
): InstallResult => {
  const written: string[] = [];
  const appended: string[] = [];
  const skipped: string[] = [];

  for (const action of actions) {
    const absPath = resolve(basePath, action.relativePath);

    if (!existsSync(absPath)) {
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, action.content + '\n', 'utf-8');
      written.push(action.relativePath);
    } else {
      const existing = readFileSync(absPath, 'utf-8');

      if (hasAiOpsSection(existing)) {
        // 기존 블록 교체 (사용자 콘텐츠 자동 보존)
        const updated = replaceAiOpsSection(existing, action.content);
        writeFileSync(absPath, updated, 'utf-8');
        const stripped = stripAiOpsSection(existing);
        (stripped.trim().length > 0 ? appended : written).push(action.relativePath);
      } else if (hasLegacyHeader(existing)) {
        // 레거시 → 새 형식으로 덮어쓰기 (update 시 자동 마이그레이션)
        writeFileSync(absPath, action.content + '\n', 'utf-8');
        written.push(action.relativePath);
      } else {
        // 순수 사용자 파일 → 최초 append
        const updated = existing.trimEnd() + '\n\n' + action.content + '\n';
        writeFileSync(absPath, updated, 'utf-8');
        appended.push(action.relativePath);
      }
    }
  }

  return { written, appended, skipped };
};
