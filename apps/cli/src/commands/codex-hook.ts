import * as p from '@clack/prompts';
import {
  buildContextPromotionHookCommand,
  CONTEXT_PROMOTION_HOOK_ID,
  inspectContextPromotionHook,
  installContextPromotionHook,
  resolveCodexHooksPath,
  uninstallContextPromotionHook,
} from '@/core/index.js';

const resolveCodexHomePath = (): string => {
  const codexHome = process.env.CODEX_HOME;
  if (codexHome && codexHome.length > 0) {
    return codexHome;
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error('CODEX_HOME or HOME is required for Codex hook commands');
  }
  return `${home}/.codex`;
};

const assertContextPromotionHookId = (hookId: string): void => {
  if (hookId !== CONTEXT_PROMOTION_HOOK_ID) {
    throw new Error(`Unknown Codex hook: ${hookId}`);
  }
};

const resolveCurrentBinPath = (): string => {
  const binPath = process.argv[1];
  if (!binPath) {
    throw new Error('Unable to resolve current ai-ops binary path');
  }
  return binPath;
};

const reportCodexHookError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

export const codexHookInstallCommand = async (hookId: string): Promise<void> => {
  p.intro(`ai-ops codex-hook install ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const hooksPath = resolveCodexHooksPath(resolveCodexHomePath());
    const result = installContextPromotionHook({
      hooksPath,
      command: buildContextPromotionHookCommand({
        nodePath: process.execPath,
        binPath: resolveCurrentBinPath(),
      }),
    });
    p.log.success(result.changed ? `hook 설치 완료: ${result.hooksPath}` : `이미 설치됨: ${result.hooksPath}`);
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook install 완료');
};

export const codexHookStatusCommand = async (hookId: string): Promise<void> => {
  p.intro(`ai-ops codex-hook status ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const result = inspectContextPromotionHook(resolveCodexHooksPath(resolveCodexHomePath()));
    p.log.info([`hooks file: ${result.hooksPath}`, `installed: ${result.installed ? 'yes' : 'no'}`].join('\n'));
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook status 완료');
};

export const codexHookUninstallCommand = async (hookId: string): Promise<void> => {
  p.intro(`ai-ops codex-hook uninstall ${hookId}`);
  try {
    assertContextPromotionHookId(hookId);
    const result = uninstallContextPromotionHook(resolveCodexHooksPath(resolveCodexHomePath()));
    p.log.success(result.removed ? `hook 제거 완료: ${result.hooksPath}` : `설치된 hook 없음: ${result.hooksPath}`);
  } catch (error) {
    reportCodexHookError(error);
  }
  p.outro('ai-ops codex-hook uninstall 완료');
};
