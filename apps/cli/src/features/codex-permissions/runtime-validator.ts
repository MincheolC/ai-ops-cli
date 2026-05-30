import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CodexPermissionProfileValidationResult, CodexPermissionProfileValidator } from './types.js';
import { resolveCodexConfigPath } from './types.js';

// ----- runtime parser validation -----

const isNodeSpawnError = (error: unknown): boolean => error instanceof Error && 'code' in error;

const readErrorCode = (error: unknown): string | null => {
  if (!isNodeSpawnError(error)) {
    return null;
  }
  const code = error.code;
  return typeof code === 'string' ? code : null;
};

const firstErrorLines = (stderr: string): string =>
  stderr
    .trim()
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, 3)
    .join(' ');

const hasIgnoredFilesystemPathWarning = (stderr: string): boolean =>
  stderr.includes('Configured filesystem path') && stderr.includes('not recognized by this version of Codex');

export const createCodexRuntimePermissionProfileValidator = (): CodexPermissionProfileValidator => (
  candidate,
): CodexPermissionProfileValidationResult => {
  const rootPath = mkdtempSync(join(tmpdir(), 'ai-ops-codex-profile-validation-'));
  const homePath = join(rootPath, 'home');
  const codexHomePath = join(rootPath, 'codex');
  try {
    mkdirSync(homePath, { recursive: true });
    mkdirSync(codexHomePath, { recursive: true });
    writeFileSync(resolveCodexConfigPath(codexHomePath), candidate.validationConfig, 'utf-8');

    const result = spawnSync('codex', ['--enable', 'exec_permission_approvals', 'debug', 'prompt-input'], {
      encoding: 'utf-8',
      env: { ...process.env, HOME: homePath, CODEX_HOME: codexHomePath },
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 5000,
    });
    if (result.error) {
      const code = readErrorCode(result.error);
      return {
        available: false,
        message: code ? `codex validation failed to run: ${code}` : 'codex validation failed to run',
      };
    }
    const stderr = typeof result.stderr === 'string' ? result.stderr : '';
    if (result.status === 0 && !hasIgnoredFilesystemPathWarning(stderr)) {
      return {
        available: true,
        valid: true,
        message: null,
      };
    }

    return {
      available: true,
      valid: false,
      message: firstErrorLines(stderr) || `codex exited with status ${result.status ?? 'unknown'}`,
    };
  } finally {
    rmSync(rootPath, { recursive: true, force: true });
  }
};
