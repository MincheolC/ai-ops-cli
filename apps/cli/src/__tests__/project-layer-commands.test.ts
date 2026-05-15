import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditCommand } from '../commands/audit.js';
import { diffCommand } from '../commands/diff.js';

const setup = (): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'project-layer-command-test-'));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
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

describe('project layer commands', () => {
  it('diff exits non-zero when error issues are present', async () => {
    const { dir, cleanup } = setup();
    try {
      await expect(runInDirectory(dir, diffCommand)).resolves.toBe(1);
    } finally {
      cleanup();
    }
  });

  it('audit exits non-zero when error issues are present', async () => {
    const { dir, cleanup } = setup();
    try {
      await expect(runInDirectory(dir, auditCommand)).resolves.toBe(1);
    } finally {
      cleanup();
    }
  });
});
