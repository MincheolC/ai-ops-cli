import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditCommand } from '../commands/audit.js';
import { diffCommand } from '../commands/diff.js';
import { initCommand } from '../commands/init.js';
import { uninstallCommand } from '../commands/uninstall.js';
import { updateCommand } from '../commands/update.js';

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

const writeUnsafeManifest = (dir: string): void => {
  mkdirSync(join(dir, '.ai-ops'), { recursive: true });
  writeFileSync(
    join(dir, '.ai-ops/manifest.json'),
    JSON.stringify({
      schemaVersion: 1,
      kind: 'project-operating-layer',
      tools: ['codex'],
      managed_files: [{ path: '../victim.md', sourceHash: 'aaaaaa' }],
      project_files: [],
      settings: {},
      sourceHash: 'aaaaaa',
      cliVersion: 'test',
      generatedAt: '2026-01-01T00:00:00.000Z',
    }),
    'utf-8',
  );
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

  it('init exits non-zero with a readable error for invalid manifests', async () => {
    const { dir, cleanup } = setup();
    try {
      writeUnsafeManifest(dir);

      await expect(runInDirectory(dir, () => initCommand({ tool: ['codex'] }))).resolves.toBe(1);
    } finally {
      cleanup();
    }
  });

  it('update exits non-zero with a readable error for invalid manifests', async () => {
    const { dir, cleanup } = setup();
    try {
      writeUnsafeManifest(dir);

      await expect(runInDirectory(dir, () => updateCommand({ force: false }))).resolves.toBe(1);
    } finally {
      cleanup();
    }
  });

  it('uninstall exits non-zero with a readable error for invalid manifests', async () => {
    const { dir, cleanup } = setup();
    try {
      writeUnsafeManifest(dir);

      await expect(runInDirectory(dir, () => uninstallCommand({ yes: true }))).resolves.toBe(1);
    } finally {
      cleanup();
    }
  });
});
