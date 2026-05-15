import * as p from '@clack/prompts';
import {
  diffProjectLayer,
  readProjectLayerManifest,
  updateProjectLayer,
} from '@/core/index.js';
import { resolveBasePath } from '../lib/paths.js';
import { reportInvalidProjectLayerManifest, reportProjectLayerApplyError } from './project-layer-errors.js';

export const updateCommand = async (opts: { force: boolean }): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro('ai-ops update');

  let manifest: ReturnType<typeof readProjectLayerManifest>;
  try {
    manifest = readProjectLayerManifest(basePath);
  } catch (error) {
    reportInvalidProjectLayerManifest({ error, outro: 'ai-ops update 실패' });
    return;
  }

  if (!manifest) {
    p.log.error('.ai-ops/manifest.json이 없습니다. 먼저 ai-ops init을 실행하세요.');
    process.exit(1);
  }

  const diffReport = diffProjectLayer(basePath);
  if (diffReport.issues.length === 0 && !opts.force) {
    p.log.info('변경 사항이 없습니다.');
    p.outro('ai-ops update 완료');
    return;
  }

  let result: ReturnType<typeof updateProjectLayer>;
  try {
    result = updateProjectLayer({ basePath, manifest });
  } catch (error) {
    reportProjectLayerApplyError({ error, outro: 'ai-ops update 실패' });
    return;
  }

  p.log.success(`managed 파일 갱신: ${result.manifest.managed_files.length}개`);
  if (result.createdProjectFiles.length > 0) {
    p.log.info(`누락된 project-owned 파일 복구:\n${result.createdProjectFiles.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.refreshedProjectFiles.length > 0) {
    p.log.info(`unmodified project-owned 파일 갱신:\n${result.refreshedProjectFiles.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.preservedProjectFiles.length > 0) {
    p.log.info(`project-owned 파일 보존:\n${result.preservedProjectFiles.map((file) => `  ${file}`).join('\n')}`);
  }

  p.outro('ai-ops update 완료');
};
