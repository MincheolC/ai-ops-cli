import * as p from '@clack/prompts';
import { rmSync } from 'node:fs';
import { readManifest, resolveManifestPath, inferInstalledFiles, MANIFEST_FILENAME } from 'ai-ops-compiler';
import { resolveBasePath } from '../lib/paths.js';
import { removeFiles, cleanEmptyDirs, collectManagedDirs } from '../lib/uninstall.js';

export const uninstallCommand = async (): Promise<void> => {
  const basePath = resolveBasePath();
  const manifestPath = resolveManifestPath(basePath);

  p.intro('ai-ops uninstall');

  // 1. manifest 읽기
  const manifest = readManifest(manifestPath);
  if (!manifest) {
    p.log.error('manifest가 없습니다. 먼저 ai-ops init을 실행하세요.');
    process.exit(1);
  }

  // 2. 삭제 대상 결정 (managed 파일 + append된 파일)
  const targetFiles = [
    ...(manifest.installed_files ?? inferInstalledFiles(manifest)),
    ...(manifest.appended_files ?? []),
  ];

  if (targetFiles.length === 0) {
    p.log.warn('삭제할 파일이 없습니다.');
    p.outro('ai-ops uninstall 완료');
    return;
  }

  // 3. 삭제 대상 목록 출력
  p.log.info(`삭제 대상 파일 (${targetFiles.length}개):\n${targetFiles.map((f) => `  ${f}`).join('\n')}`);

  // 4. confirm
  const confirmed = await p.confirm({
    message: '위 파일과 manifest를 모두 삭제하시겠습니까?',
    initialValue: false,
  });
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('취소됨');
    process.exit(0);
  }

  // 5. 파일 삭제
  const result = removeFiles(basePath, targetFiles);

  // 6. 빈 디렉토리 정리
  const dirs = collectManagedDirs(targetFiles);
  const removedDirs = cleanEmptyDirs(basePath, dirs);

  // 7. manifest 삭제
  rmSync(manifestPath, { force: true });

  // 8. 결과 요약
  if (result.deleted.length > 0) {
    p.log.success(`삭제 완료 (${result.deleted.length}개):\n${result.deleted.map((f) => `  ${f}`).join('\n')}`);
  }
  if (result.cleaned.length > 0) {
    p.log.success(
      `섹션 제거 완료 (사용자 내용 보존, ${result.cleaned.length}개):\n${result.cleaned.map((f) => `  ${f}`).join('\n')}`,
    );
  }
  if (result.skipped.length > 0) {
    p.log.warn(
      `건너뜀 (non-managed 파일 보호, ${result.skipped.length}개):\n${result.skipped.map((f) => `  ${f}`).join('\n')}`,
    );
  }
  if (result.notFound.length > 0) {
    p.log.info(`이미 없음 (${result.notFound.length}개):\n${result.notFound.map((f) => `  ${f}`).join('\n')}`);
  }
  if (removedDirs.length > 0) {
    p.log.info(`빈 디렉토리 정리 (${removedDirs.length}개):\n${removedDirs.map((d) => `  ${d}`).join('\n')}`);
  }

  p.log.success(`manifest 삭제: ${MANIFEST_FILENAME}`);
  p.outro('ai-ops uninstall 완료');
};
