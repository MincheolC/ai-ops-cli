import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildContextPromotionHookCommand,
  buildCodexHookCommand,
  inspectContextPromotionHook,
  inspectCodexHook,
  installContextPromotionHook,
  installCodexHook,
  PC_CODEX_HOOK,
  quoteShellArg,
  resolveCodexHooksPath,
  uninstallContextPromotionHook,
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

describe('Codex context promotion hook config', () => {
  it('builds portable hook commands and validates overrides', () => {
    expect(quoteShellArg("/tmp/it's/node")).toBe("'/tmp/it'\\''s/node'");
    expect(buildContextPromotionHookCommand()).toBe(
      'ai-ops integration hook post-tool-use --workflows context-promotion',
    );
    expect(buildContextPromotionHookCommand('/custom/bin/ai-ops integration hook post-tool-use')).toBe(
      '/custom/bin/ai-ops integration hook post-tool-use --workflows context-promotion',
    );
    expect(() => buildContextPromotionHookCommand('/custom/bin/ai-ops hook')).toThrow(
      'context-promotion hook command must include',
    );
  });

  it('installs the PostToolUse context promotion hook without removing existing hooks', () => {
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

      const result = installContextPromotionHook({
        hooksPath,
      });
      const second = installContextPromotionHook({
        hooksPath,
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(true);
      expect(raw).toContain('echo keep');
      expect(raw).toContain('integration hook post-tool-use --workflows context-promotion');
      expect(raw.match(/integration hook post-tool-use/g)?.length).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('replaces legacy PreToolUse context promotion hook during install', () => {
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
                  hooks: [
                    {
                      type: 'command',
                      command: "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook pre-tool-use",
                    },
                    { type: 'command', command: 'echo keep' },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const result = installContextPromotionHook({
        hooksPath,
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.changed).toBe(true);
      expect(raw).toContain('echo keep');
      expect(raw).not.toContain('context-promotion hook pre-tool-use');
      expect(raw).toContain('integration hook post-tool-use --workflows context-promotion');
    } finally {
      cleanup();
    }
  });

  it('uninstalls only the ai-ops context promotion hook', () => {
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
                  hooks: [
                    {
                      type: 'command',
                      command: "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook pre-tool-use",
                    },
                  ],
                },
                {
                  matcher: '^Bash$',
                  hooks: [{ type: 'command', command: 'echo keep' }],
                },
              ],
              PostToolUse: [
                {
                  matcher: '^Bash$',
                  hooks: [
                    {
                      type: 'command',
                      command: "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook post-tool-use",
                    },
                  ],
                },
              ],
            },
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const result = uninstallContextPromotionHook(hooksPath);
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.removed).toBe(true);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(false);
      expect(raw).toContain('echo keep');
      expect(raw).not.toContain('context-promotion hook pre-tool-use');
      expect(raw).not.toContain('context-promotion hook post-tool-use');
      expect(raw).not.toContain('integration hook post-tool-use');
    } finally {
      cleanup();
    }
  });

  it('reports not installed for a missing hooks file', () => {
    const { hooksPath, cleanup } = setup();
    try {
      expect(existsSync(hooksPath)).toBe(false);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('installs and uninstalls the pc hook independently from context promotion', () => {
    const { hooksPath, cleanup } = setup();
    try {
      const pcCommand = buildCodexHookCommand({ definition: PC_CODEX_HOOK });
      installContextPromotionHook({
        hooksPath,
      });
      const result = installCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
        command: pcCommand,
      });

      expect(result.changed).toBe(true);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(true);
      expect(inspectCodexHook({ hooksPath, definition: PC_CODEX_HOOK }).installed).toBe(true);
      expect(readFileSync(hooksPath, 'utf-8').match(/integration hook post-tool-use/g)?.length).toBe(1);
      expect(readFileSync(hooksPath, 'utf-8')).toContain('--workflows context-promotion,pc');

      const removed = uninstallCodexHook({
        hooksPath,
        definition: PC_CODEX_HOOK,
      });

      expect(removed.removed).toBe(true);
      expect(inspectCodexHook({ hooksPath, definition: PC_CODEX_HOOK }).installed).toBe(false);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(true);
      expect(readFileSync(hooksPath, 'utf-8')).toContain('--workflows context-promotion');
      expect(readFileSync(hooksPath, 'utf-8')).not.toContain('integration hook post-tool-use pc');
    } finally {
      cleanup();
    }
  });

  it('writes commandWindows only when a Windows override is provided', () => {
    const { hooksPath, cleanup } = setup();
    try {
      const result = installContextPromotionHook({
        hooksPath,
        command: '/custom/bin/ai-ops integration hook post-tool-use',
        commandWindows: 'C:\\tools\\ai-ops.exe integration hook post-tool-use',
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.command).toBe('/custom/bin/ai-ops integration hook post-tool-use --workflows context-promotion');
      expect(result.commandWindows).toBe(
        'C:\\tools\\ai-ops.exe integration hook post-tool-use --workflows context-promotion',
      );
      expect(raw).toContain('"commandWindows"');
      expect(() =>
        installContextPromotionHook({
          hooksPath,
          commandWindows: 'C:\\tools\\ai-ops.exe context-promotion hook post-tool-use',
        }),
      ).toThrow('context-promotion hook command must include');
    } finally {
      cleanup();
    }
  });
});
