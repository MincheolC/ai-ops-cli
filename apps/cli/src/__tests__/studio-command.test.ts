import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launchStudio } from '../features/studio/launcher.js';
import { studioSnapshotCommand } from '../features/studio/commands.js';

const setup = (): { dir: string; userHome: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-command-project-'));
  const userHome = mkdtempSync(join(tmpdir(), 'studio-command-home-'));
  return {
    dir,
    userHome,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(userHome, { recursive: true, force: true });
    },
  };
};

const runInDirectory = async (dir: string, command: () => Promise<void>): Promise<number | string | undefined> => {
  const previousCwd = process.cwd();
  const previousExitCode = process.exitCode;

  try {
    process.chdir(dir);
    process.exitCode = undefined;
    await command();
    return process.exitCode;
  } finally {
    process.chdir(previousCwd);
    process.exitCode = previousExitCode;
  }
};

describe('studio command', () => {
  it('launches the macOS arm64 Studio binary for an absolute project path', () => {
    const { dir, cleanup } = setup();
    const packageDir = mkdtempSync(join(tmpdir(), 'studio-platform-package-'));
    const packageJsonPath = join(packageDir, 'package.json');
    const binaryPath = join(packageDir, 'bin/ai-ops-studio');
    let capturedBinaryPath: string | null = null;
    let capturedEnv: NodeJS.ProcessEnv | null = null;

    try {
      mkdirSync(join(packageDir, 'bin'), { recursive: true });
      writeFileSync(packageJsonPath, '{}');
      writeFileSync(binaryPath, '');

      const result = launchStudio({
        project: '.',
        deps: {
          platform: 'darwin',
          arch: 'arm64',
          cwd: dir,
          cliBinPath: '/usr/local/bin/ai-ops',
          env: { PATH: '/usr/bin' },
          resolvePackageJsonPath: () => packageJsonPath,
          exists: (path) => path === binaryPath,
          isDirectory: (path) => path === dir,
          spawnStudioBinary: (path, env) => {
            capturedBinaryPath = path;
            capturedEnv = env;
            return { status: 0, signal: null };
          },
        },
      });

      expect(result).toEqual({ ok: true, exitCode: 0 });
      expect(capturedBinaryPath).toBe(binaryPath);
      expect(capturedEnv).toMatchObject({
        PATH: '/usr/bin',
        AI_OPS_STUDIO_PROJECT_ROOT: dir,
        AI_OPS_CLI_BIN: '/usr/local/bin/ai-ops',
      });
    } finally {
      rmSync(packageDir, { recursive: true, force: true });
      cleanup();
    }
  });

  it('reports unsupported platforms before resolving optional packages', () => {
    const { dir, cleanup } = setup();

    try {
      const result = launchStudio({
        project: '.',
        deps: {
          platform: 'linux',
          arch: 'x64',
          cwd: dir,
          isDirectory: (path) => path === dir,
          resolvePackageJsonPath: () => {
            throw new Error('should not resolve package');
          },
        },
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: 1,
      });
      expect(result.ok === false ? result.message : '').toContain('not available for linux/x64');
    } finally {
      cleanup();
    }
  });

  it('reports a missing macOS arm64 optional platform package', () => {
    const { dir, cleanup } = setup();

    try {
      const result = launchStudio({
        project: '.',
        deps: {
          platform: 'darwin',
          arch: 'arm64',
          cwd: dir,
          isDirectory: (path) => path === dir,
          resolvePackageJsonPath: () => {
            throw new Error('Cannot find module');
          },
        },
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: 1,
      });
      expect(result.ok === false ? result.message : '').toContain('ai-ops-studio-darwin-arm64');
    } finally {
      cleanup();
    }
  });

  it('reports invalid project paths without launching Studio', () => {
    const { dir, cleanup } = setup();

    try {
      const result = launchStudio({
        project: 'missing',
        deps: {
          platform: 'darwin',
          arch: 'arm64',
          cwd: dir,
          isDirectory: () => false,
        },
      });

      expect(result).toMatchObject({
        ok: false,
        exitCode: 1,
      });
      expect(result.ok === false ? result.message : '').toContain('Project path is not a directory');
    } finally {
      cleanup();
    }
  });

  it('writes JSON-only snapshot output and succeeds even with audit errors', async () => {
    const { dir, userHome, cleanup } = setup();
    const previousAiOpsHome = process.env.AI_OPS_HOME;
    const previousCodexHome = process.env.CODEX_HOME;
    let output = '';
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array): boolean => {
      output += chunk.toString();
      return true;
    });

    try {
      process.env.AI_OPS_HOME = userHome;
      process.env.CODEX_HOME = join(userHome, '.codex');

      await expect(runInDirectory(dir, () => studioSnapshotCommand({ json: true }))).resolves.toBeUndefined();

      const parsed: unknown = JSON.parse(output);
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        kind: 'ai-ops-studio-snapshot',
        project: {
          state: 'uninitialized',
        },
      });
      expect(output).not.toContain('ai-ops studio');
      expect(output).not.toContain('[studio-snapshot]');
    } finally {
      stdout.mockRestore();
      if (previousAiOpsHome === undefined) {
        delete process.env.AI_OPS_HOME;
      } else {
        process.env.AI_OPS_HOME = previousAiOpsHome;
      }
      if (previousCodexHome === undefined) {
        delete process.env.CODEX_HOME;
      } else {
        process.env.CODEX_HOME = previousCodexHome;
      }
      cleanup();
    }
  });
});
