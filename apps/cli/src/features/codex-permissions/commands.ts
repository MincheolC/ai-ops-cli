import * as p from '@clack/prompts';
import {
  CODEX_PERMISSION_PROFILE,
  inspectCodexSafePermissions,
  installCodexSafePermissions,
  uninstallCodexSafePermissions,
} from './core.js';
import type { CodexPermissionProfile, CodexSafePermissionFileStatus, CodexSafePermissionStatus } from './core.js';
import { resolveUserBasePath } from '../../shared/command-paths.js';

const resolveCodexHomePath = (): string => {
  const codexHome = process.env.CODEX_HOME;
  if (codexHome && codexHome.length > 0) {
    return codexHome;
  }
  const home = process.env.HOME;
  if (!home) {
    throw new Error('CODEX_HOME or HOME is required for Codex permission commands');
  }
  return `${home}/.codex`;
};

const resolveHomePath = (): string => {
  const home = process.env.HOME;
  if (!home) {
    throw new Error('HOME is required for Codex safe-local permissions');
  }
  return home;
};

const resolvePersonalContextRoot = (): string => `${resolveHomePath()}/.personal-project-contexts`;

const assertCodexPermissionProfile = (profile: string): CodexPermissionProfile => {
  if (profile === CODEX_PERMISSION_PROFILE.SAFE_LOCAL) {
    return profile;
  }
  throw new Error(`Unknown Codex permission profile: ${profile}`);
};

const reportCodexPermissionsError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

const formatFileStatus = (label: string, status: CodexSafePermissionFileStatus): string =>
  [
    `${label}: ${status.installed ? 'installed' : 'not installed'}`,
    `path: ${status.path}`,
    `changed: ${status.changed ? 'yes' : 'no'}`,
    `conflict: ${status.conflict ?? 'none'}`,
  ].join('\n');

const formatStatus = (status: CodexSafePermissionStatus): string =>
  [
    formatFileStatus('config', status.config),
    formatFileStatus('rules', status.rules),
    formatFileStatus('hook', status.hook),
  ].join('\n\n');

const statusHasConflict = (status: CodexSafePermissionStatus): boolean =>
  [status.config, status.rules, status.hook].some((fileStatus) => fileStatus.conflict !== null);

const resolveSafePermissionPaths = (): {
  codexHomePath: string;
  userBasePath: string;
  personalContextRoot: string;
} => ({
  codexHomePath: resolveCodexHomePath(),
  userBasePath: resolveUserBasePath(),
  personalContextRoot: resolvePersonalContextRoot(),
});

export const codexPermissionsInstallCommand = async (profile: string): Promise<void> => {
  p.intro(`ai-ops codex-permissions install ${profile}`);
  try {
    assertCodexPermissionProfile(profile);
    const status = installCodexSafePermissions(resolveSafePermissionPaths());
    p.log.info(formatStatus(status));
    if (statusHasConflict(status)) {
      process.exitCode = 1;
    }
  } catch (error) {
    reportCodexPermissionsError(error);
  }
  p.outro('ai-ops codex-permissions install 완료');
};

export const codexPermissionsStatusCommand = async (profile: string): Promise<void> => {
  p.intro(`ai-ops codex-permissions status ${profile}`);
  try {
    assertCodexPermissionProfile(profile);
    p.log.info(formatStatus(inspectCodexSafePermissions(resolveSafePermissionPaths())));
  } catch (error) {
    reportCodexPermissionsError(error);
  }
  p.outro('ai-ops codex-permissions status 완료');
};

export const codexPermissionsUninstallCommand = async (profile: string): Promise<void> => {
  p.intro(`ai-ops codex-permissions uninstall ${profile}`);
  try {
    assertCodexPermissionProfile(profile);
    p.log.info(formatStatus(uninstallCodexSafePermissions(resolveSafePermissionPaths())));
  } catch (error) {
    reportCodexPermissionsError(error);
  }
  p.outro('ai-ops codex-permissions uninstall 완료');
};

export const codexPermissionsPermissionRequestHookCommand = async (profile: string): Promise<void> => {
  try {
    assertCodexPermissionProfile(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stdout.write(
      `${JSON.stringify({
        systemMessage: `ai-ops codex permission hook skipped: ${message}`,
      })}\n`,
    );
  }
};
