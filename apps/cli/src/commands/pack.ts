import * as p from '@clack/prompts';
import {
  diffProjectLayerPack,
  installProjectLayerPack,
  loadAllPacks,
  readProjectLayerManifest,
  uninstallProjectLayerPack,
  updateProjectLayerPack,
} from '@/core/index.js';
import type { ProjectLayerManifest } from '@/core/index.js';
import { resolveBasePath, resolvePacksDir } from '../lib/paths.js';

const readManifestForPackCommand = (basePath: string): ProjectLayerManifest | null => {
  try {
    return readProjectLayerManifest(basePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    p.log.error(`.ai-ops/manifest.json 파싱 실패: ${message}`);
    process.exitCode = 1;
    return null;
  }
};

const reportPackError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

export const packListCommand = async (): Promise<void> => {
  const basePath = resolveBasePath();
  const packs = loadAllPacks(resolvePacksDir());
  const manifest = readManifestForPackCommand(basePath);
  const installedPackIds = new Set(manifest?.packs.map((pack) => pack.id) ?? []);

  p.intro('ai-ops pack list');
  p.log.info(
    packs
      .map((pack) => {
        const suffix = installedPackIds.has(pack.id) ? 'installed' : 'not installed';
        return `- ${pack.id} - ${suffix}`;
      })
      .join('\n'),
  );
  p.outro('ai-ops pack list 완료');
};

export const packInstallCommand = async (packId: string): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro(`ai-ops pack install ${packId}`);
  try {
    const result = installProjectLayerPack({ basePath, packId, packsDir: resolvePacksDir() });
    p.log.success(`pack 설치 완료: ${packId}`);
    if (result.written.length > 0) {
      p.log.info(`생성:\n${result.written.map((file) => `  ${file}`).join('\n')}`);
    }
    if (result.refreshed.length > 0) {
      p.log.info(`갱신:\n${result.refreshed.map((file) => `  ${file}`).join('\n')}`);
    }
    if (result.preserved.length > 0) {
      p.log.info(`보존:\n${result.preserved.map((file) => `  ${file}`).join('\n')}`);
    }
  } catch (error) {
    reportPackError(error);
  }
  p.outro('ai-ops pack install 완료');
};

export const packDiffCommand = async (packId: string | undefined): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro('ai-ops pack diff');
  try {
    const report = diffProjectLayerPack({ basePath, packId, packsDir: resolvePacksDir() });
    if (report.issues.length === 0) {
      p.log.success('변경 사항 없음. pack이 최신 상태입니다.');
      p.outro('ai-ops pack diff 완료');
      return;
    }

    for (const item of report.issues) {
      const line = `[${item.code}] ${item.message}`;
      if (item.level === 'error') {
        p.log.error(line);
      } else {
        p.log.warn(line);
      }
    }

    if (report.issues.some((item) => item.level === 'error')) {
      process.exitCode = 1;
    }
  } catch (error) {
    reportPackError(error);
  }
  p.outro('ai-ops pack diff 완료');
};

export const packUpdateCommand = async (packId: string | undefined): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro('ai-ops pack update');
  try {
    const manifest = readManifestForPackCommand(basePath);
    if (!manifest) {
      p.log.error('.ai-ops/manifest.json이 없습니다. 먼저 ai-ops init을 실행하세요.');
      process.exitCode = 1;
      p.outro('ai-ops pack update 완료');
      return;
    }

    const targetPackIds = packId ? [packId] : manifest.packs.map((pack) => pack.id);
    if (targetPackIds.length === 0) {
      p.log.warn('갱신할 설치된 pack이 없습니다.');
      p.outro('ai-ops pack update 완료');
      return;
    }

    for (const targetPackId of targetPackIds) {
      const result = updateProjectLayerPack({ basePath, packId: targetPackId, packsDir: resolvePacksDir() });
      p.log.success(`pack 갱신 완료: ${targetPackId}`);
      if (result.refreshed.length > 0) {
        p.log.info(`갱신:\n${result.refreshed.map((file) => `  ${file}`).join('\n')}`);
      }
      if (result.preserved.length > 0) {
        p.log.info(`보존:\n${result.preserved.map((file) => `  ${file}`).join('\n')}`);
      }
    }
  } catch (error) {
    reportPackError(error);
  }
  p.outro('ai-ops pack update 완료');
};

export const packUninstallCommand = async (packId: string): Promise<void> => {
  const basePath = resolveBasePath();

  p.intro(`ai-ops pack uninstall ${packId}`);
  try {
    const result = uninstallProjectLayerPack({ basePath, packId });
    p.log.success(`pack 제거 완료: ${packId}`);
    if (result.deleted.length > 0) {
      p.log.info(`삭제:\n${result.deleted.map((file) => `  ${file}`).join('\n')}`);
    }
    if (result.preserved.length > 0) {
      p.log.info(`보존:\n${result.preserved.map((file) => `  ${file}`).join('\n')}`);
    }
  } catch (error) {
    reportPackError(error);
  }
  p.outro('ai-ops pack uninstall 완료');
};
