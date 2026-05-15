import * as p from '@clack/prompts';
import { readProjectLayerManifest, uninstallProjectLayer } from '@/core/index.js';
import { resolveBasePath } from '../lib/paths.js';
import { reportInvalidProjectLayerManifest } from './project-layer-errors.js';

type UninstallCommandOptions = {
  yes?: boolean;
};

export const uninstallCommand = async (opts: UninstallCommandOptions = {}): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro('ai-ops uninstall');

  let manifest: ReturnType<typeof readProjectLayerManifest>;
  try {
    manifest = readProjectLayerManifest(basePath);
  } catch (error) {
    reportInvalidProjectLayerManifest({ error, outro: 'ai-ops uninstall 실패' });
    return;
  }

  if (!manifest) {
    p.log.error('.ai-ops/manifest.json이 없습니다. project operating layer가 설치되어 있지 않습니다.');
    process.exitCode = 1;
    p.outro('ai-ops uninstall 실패');
    return;
  }

  const targetFiles = [
    ...manifest.managed_files.map((file) => file.path),
    ...manifest.project_files.map((file) => file.path),
    '.ai-ops/context-layer.json',
    '.ai-ops/manifest.json',
  ];

  p.log.info(`처리 대상 (${targetFiles.length}개):\n${targetFiles.map((file) => `  ${file}`).join('\n')}`);

  if (!opts.yes) {
    const confirmed = await p.confirm({
      message: 'project operating layer를 제거하시겠습니까?',
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('취소됨');
      process.exit(0);
    }
  }

  const result = uninstallProjectLayer(basePath, manifest);

  if (result.deleted.length > 0) {
    p.log.success(`삭제 완료:\n${result.deleted.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.cleaned.length > 0) {
    p.log.success(`managed section 제거, 사용자 내용 보존:\n${result.cleaned.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.preserved.length > 0) {
    p.log.info(`수정되었거나 기존에 있던 project-owned 파일 보존:\n${result.preserved.map((file) => `  ${file}`).join('\n')}`);
  }
  if (result.notFound.length > 0) {
    p.log.info(`이미 없음:\n${result.notFound.map((file) => `  ${file}`).join('\n')}`);
  }

  p.outro('ai-ops uninstall 완료');
};
