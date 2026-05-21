import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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
