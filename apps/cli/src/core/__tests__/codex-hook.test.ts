import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildContextPromotionHookCommand,
  inspectContextPromotionHook,
  installContextPromotionHook,
  quoteShellArg,
  resolveCodexHooksPath,
  uninstallContextPromotionHook,
} from '../codex-hook.js';

const setup = (): { dir: string; hooksPath: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-hook-test-'));
  return {
    dir,
    hooksPath: resolveCodexHooksPath(dir),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

describe('Codex context promotion hook config', () => {
  it('quotes hook command arguments', () => {
    expect(quoteShellArg("/tmp/it's/node")).toBe("'/tmp/it'\\''s/node'");
    expect(buildContextPromotionHookCommand({ nodePath: '/usr/bin/node', binPath: '/tmp/ai-ops' })).toBe(
      "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook pre-tool-use",
    );
  });

  it('installs the context promotion hook without removing existing hooks', () => {
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
        command: "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook pre-tool-use",
      });
      const second = installContextPromotionHook({
        hooksPath,
        command: "'/usr/bin/node' '/tmp/ai-ops' context-promotion hook pre-tool-use",
      });
      const raw = readFileSync(hooksPath, 'utf-8');

      expect(result.changed).toBe(true);
      expect(second.changed).toBe(false);
      expect(inspectContextPromotionHook(hooksPath).installed).toBe(true);
      expect(raw).toContain('echo keep');
      expect(raw.match(/context-promotion hook pre-tool-use/g)?.length).toBe(1);
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
});
