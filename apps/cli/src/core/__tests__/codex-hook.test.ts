import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildCodexHookCommand,
  inspectCodexHook,
  installCodexHook,
  PC_CODEX_HOOK,
  quoteShellArg,
  resolveCodexHooksPath,
  uninstallCodexHook,
} from '../../features/codex-hooks/core.js';

const setup = (): { dir: string; hooksPath: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-hook-test-'));
  return {
    dir,
    hooksPath: resolveCodexHooksPath(dir),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

describe('Codex pc hook config', () => {
  it('builds portable hook commands and validates overrides', () => {
    expect(quoteShellArg("/tmp/it's/node")).toBe("'/tmp/it'\\''s/node'");
    expect(buildCodexHookCommand({ definition: PC_CODEX_HOOK })).toBe(
      'ai-ops integration hook post-tool-use --workflows pc',
    );
    expect(
      buildCodexHookCommand({
        definition: PC_CODEX_HOOK,
        overrideCommand: '/custom/bin/ai-ops integration hook post-tool-use',
      }),
    ).toBe('/custom/bin/ai-ops integration hook post-tool-use --workflows pc');
    expect(() =>
      buildCodexHookCommand({
        definition: PC_CODEX_HOOK,
        overrideCommand: '/custom/bin/ai-ops hook',
      }),
    ).toThrow('pc hook command must include');
  });

  it('installs the PostToolUse pc hook without removing non-ai-ops hooks', () => {
    const { hooksPath, cleanup } = setup();
    try {
      writeFileSync(
        hooksPath,
        JSON.stringify(
          {
            hooks: {
              PreToolUse: [
                {
                  matcher: '^Bash$',
                  hooks: [{ type: 'command', command: 'echo keep' }],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const result = installCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
      });
      const second = installCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(inspectCodexHook({ hooksPath, definition: PC_CODEX_HOOK }).installed).toBe(true);
      expect(raw).toContain('echo keep');
      expect(raw).toContain('integration hook post-tool-use --workflows pc');
      expect(raw.match(/integration hook post-tool-use/g)?.length).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('uninstalls only the ai-ops pc hook', () => {
    const { hooksPath, cleanup } = setup();
    try {
      installCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
      });
      const installedConfig = JSON.parse(readFileSync(hooksPath, 'utf-8')) as {
        hooks: { PostToolUse: unknown[] };
      };
      writeFileSync(
        hooksPath,
        JSON.stringify(
          {
            hooks: {
              PostToolUse: [
                ...installedConfig.hooks.PostToolUse,
                {
                  matcher: '^Bash$',
                  hooks: [{ type: 'command', command: 'echo keep' }],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const result = uninstallCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.removed).toBe(true);
      expect(inspectCodexHook({ hooksPath, definition: PC_CODEX_HOOK }).installed).toBe(false);
      expect(raw).toContain('echo keep');
      expect(raw).not.toContain('integration hook post-tool-use');
    } finally {
      cleanup();
    }
  });

  it('reports not installed for a missing hooks file', () => {
    const { hooksPath, cleanup } = setup();
    try {
      expect(existsSync(hooksPath)).toBe(false);
      expect(inspectCodexHook({ hooksPath, definition: PC_CODEX_HOOK }).installed).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('writes commandWindows only when a Windows override is provided', () => {
    const { hooksPath, cleanup } = setup();
    try {
      const result = installCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
        command: '/custom/bin/ai-ops integration hook post-tool-use',
        commandWindows: 'C:\\tools\\ai-ops.exe integration hook post-tool-use',
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.command).toBe('/custom/bin/ai-ops integration hook post-tool-use --workflows pc');
      expect(result.commandWindows).toBe('C:\\tools\\ai-ops.exe integration hook post-tool-use --workflows pc');
      expect(raw).toContain('"commandWindows"');
      expect(() =>
        installCodexHook({
          hooksPath,
          definition: PC_CODEX_HOOK,
          commandWindows: 'C:\\tools\\ai-ops.exe pc hook post-tool-use',
        }),
      ).toThrow('pc hook command must include');
    } finally {
      cleanup();
    }
  });
});
