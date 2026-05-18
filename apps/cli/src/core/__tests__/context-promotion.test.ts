import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildContextPromotionReceipt,
  computeContextPromotionFingerprint,
  CONTEXT_PROMOTION_DECISION,
  CONTEXT_PROMOTION_SCOPE,
  evaluateContextPromotionPostToolUseHook,
  getContextPromotionStatus,
  isGitCommitCommand,
  pruneContextPromotionReceipts,
  resolveContextPromotion,
  resolveContextPromotionReceiptIndexPath,
  upsertContextPromotionReceipt,
} from '../context-promotion.js';

const TEST_COMMIT_HASH = '0123456789abcdef0123456789abcdef01234567';

const setupGitRepo = (withContextLayer = true): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'context-promotion-test-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  writeFileSync(join(dir, 'tracked.txt'), 'initial\n', 'utf-8');
  if (withContextLayer) {
    mkdirSync(join(dir, '.ai-ops'), { recursive: true });
    writeFileSync(join(dir, '.ai-ops/context-layer.json'), '{"schemaVersion":1}\n', 'utf-8');
  }
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

describe('context promotion receipts', () => {
  it('fingerprint changes for unstaged, staged, and untracked changes', () => {
    const { dir, cleanup } = setupGitRepo();
    try {
      const initial = computeContextPromotionFingerprint(dir);
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');
      const unstaged = computeContextPromotionFingerprint(dir);
      execFileSync('git', ['add', 'tracked.txt'], { cwd: dir });
      const staged = computeContextPromotionFingerprint(dir);
      writeFileSync(join(dir, 'untracked.txt'), 'new\n', 'utf-8');
      const untracked = computeContextPromotionFingerprint(dir);

      expect(unstaged).not.toBe(initial);
      expect(staged).not.toBe(unstaged);
      expect(untracked).not.toBe(staged);
    } finally {
      cleanup();
    }
  });

  it('fingerprint computation fails closed when git cannot read the index', () => {
    const { dir, cleanup } = setupGitRepo();
    try {
      writeFileSync(join(dir, '.git/index'), 'broken', 'utf-8');

      expect(() => computeContextPromotionFingerprint(dir)).toThrow();
    } finally {
      cleanup();
    }
  });

  it('resolve writes a user-local receipt for the current fingerprint', () => {
    const { dir, cleanup } = setupGitRepo();
    const userHome = mkdtempSync(join(tmpdir(), 'context-promotion-home-'));
    try {
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');

      const before = getContextPromotionStatus({ cwd: dir, userBasePath: userHome });
      expect(before.receipt).toBeNull();

      const after = resolveContextPromotion({
        cwd: dir,
        userBasePath: userHome,
        input: {
          decision: CONTEXT_PROMOTION_DECISION.NO_PROMOTION,
          summary: 'No reusable operating knowledge found',
          scopes: [],
          targets: [],
        },
      });

      expect(after.receipt?.decision).toBe(CONTEXT_PROMOTION_DECISION.NO_PROMOTION);
      expect(after.receipt?.commitHash).toBe(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf-8' }).trim());
      expect(after.receiptIndexPath?.startsWith(userHome)).toBe(true);
      expect(existsSync(join(dir, '.ai-ops/context-promotion'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('requires summary and scope rules for receipts', () => {
    expect(() =>
      buildContextPromotionReceipt({
        fingerprint: '1234567890abcdef',
        commitHash: TEST_COMMIT_HASH,
        input: {
          decision: CONTEXT_PROMOTION_DECISION.NO_PROMOTION,
          summary: '',
          scopes: [],
          targets: [],
        },
      }),
    ).toThrow('summary is required');

    expect(() =>
      buildContextPromotionReceipt({
        fingerprint: '1234567890abcdef',
        commitHash: TEST_COMMIT_HASH,
        input: {
          decision: CONTEXT_PROMOTION_DECISION.PROMOTED,
          summary: 'Promoted core rule',
          scopes: [],
          targets: [],
        },
      }),
    ).toThrow('at least one scope is required');
  });

  it('prunes receipts to the requested max count', () => {
    const { dir, cleanup } = setupGitRepo();
    const userHome = mkdtempSync(join(tmpdir(), 'context-promotion-home-'));
    try {
      const projectKey = '123456789abc';
      const indexPath = resolveContextPromotionReceiptIndexPath({ userBasePath: userHome, projectKey });
      for (const [fingerprint, resolvedAt] of [
        ['0000000000000001', '2026-01-01T00:00:00.000Z'],
        ['0000000000000002', '2026-01-02T00:00:00.000Z'],
        ['0000000000000003', '2026-01-03T00:00:00.000Z'],
      ] as const) {
        upsertContextPromotionReceipt({
          indexPath,
          projectKey,
          projectRoot: dir,
          receipt: buildContextPromotionReceipt({
            fingerprint,
            commitHash: `0123456789abcdef0123456789abcdef0123456${fingerprint.at(-1) ?? '0'}`,
            resolvedAt,
            input: {
              decision: CONTEXT_PROMOTION_DECISION.PROMOTED,
              summary: `summary ${fingerprint}`,
              scopes: [CONTEXT_PROMOTION_SCOPE.CORE],
              targets: ['docs/plan.md'],
            },
          }),
          maxReceipts: 10,
        });
      }

      const pruned = pruneContextPromotionReceipts({ indexPath, maxReceipts: 2 });
      expect(pruned?.receipts.map((receipt) => receipt.fingerprint)).toEqual([
        '0000000000000003',
        '0000000000000002',
      ]);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });
});

describe('context promotion PostToolUse hook', () => {
  it('detects git commit through common shell wrappers and boundaries', () => {
    expect(isGitCommitCommand('git commit -m test')).toBe(true);
    expect(isGitCommitCommand('cd /repo && git commit -m test')).toBe(true);
    expect(isGitCommitCommand("bash -lc 'git commit -m test'")).toBe(true);
    expect(isGitCommitCommand('(git commit -m test)')).toBe(true);
    expect(isGitCommitCommand('git -C /repo commit -m test')).toBe(true);
    expect(isGitCommitCommand('git status')).toBe(false);
    expect(isGitCommitCommand('echo git commit')).toBe(false);
  });

  it('ignores non-commit commands, non-Bash tools, failed commands, and repos without ai-ops context layer', () => {
    const { dir, cleanup } = setupGitRepo(false);
    const userHome = mkdtempSync(join(tmpdir(), 'context-promotion-home-'));
    try {
      expect(
        evaluateContextPromotionPostToolUseHook({
          userBasePath: userHome,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git status' },
          },
        }),
      ).toBeNull();

      for (const toolResponse of [
        'On branch feature/test\nnothing to commit, working tree clean\n',
        'fatal: cannot run .git/hooks/pre-commit: No such file or directory\n',
        'husky - pre-commit hook failed (code 1)\n',
        { stderr: 'error: commit failed because a hook declined the commit\n' },
      ]) {
        expect(
          evaluateContextPromotionPostToolUseHook({
            userBasePath: userHome,
            hookInput: {
              hook_event_name: 'PostToolUse',
              cwd: dir,
              tool_name: 'Bash',
              tool_input: { command: 'git commit -m test' },
              tool_response: toolResponse,
            },
          }),
        ).toBeNull();
      }

      expect(
        evaluateContextPromotionPostToolUseHook({
          userBasePath: userHome,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'apply_patch',
            tool_input: { command: 'git commit -m test' },
          },
        }),
      ).toBeNull();

      expect(
        evaluateContextPromotionPostToolUseHook({
          userBasePath: userHome,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m test' },
            tool_response: { exit_code: 1 },
          },
        }),
      ).toBeNull();

      expect(
        evaluateContextPromotionPostToolUseHook({
          userBasePath: userHome,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m test' },
          },
        }),
      ).toBeNull();
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('continues Codex after a git commit until the current HEAD has a receipt', () => {
    const { dir, cleanup } = setupGitRepo();
    const userHome = mkdtempSync(join(tmpdir(), 'context-promotion-home-'));
    try {
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'work'], { cwd: dir, stdio: 'ignore' });
      const hookInput = {
        hook_event_name: 'PostToolUse',
        cwd: dir,
        tool_name: 'Bash',
        tool_input: { command: 'git commit -m work' },
        tool_response:
          '[main 1234567] fix: handle nothing to commit and command failed text\n 1 file changed, 1 insertion(+), 1 deletion(-)\n',
      };

      const before = evaluateContextPromotionPostToolUseHook({ userBasePath: userHome, hookInput });
      expect(before?.decision).toBe('block');
      expect(before?.reason).toContain('context-promotion-review');
      expect(before?.reason).toContain('git show --stat HEAD');
      expect(before?.hookSpecificOutput.hookEventName).toBe('PostToolUse');

      const objectResponse = evaluateContextPromotionPostToolUseHook({
        userBasePath: userHome,
        hookInput: {
          hook_event_name: 'PostToolUse',
          cwd: dir,
          tool_name: 'Bash',
          tool_input: { command: 'git commit -m work' },
          tool_response: {
            stdout:
              '[main 89abcde] fix: avoid commit failed false positive\n 1 file changed, 1 insertion(+)\n',
          },
        },
      });
      expect(objectResponse?.decision).toBe('block');

      resolveContextPromotion({
        cwd: dir,
        userBasePath: userHome,
        input: {
          decision: CONTEXT_PROMOTION_DECISION.NO_PROMOTION,
          summary: 'No promotion',
          scopes: [],
          targets: [],
        },
      });

      expect(evaluateContextPromotionPostToolUseHook({ userBasePath: userHome, hookInput })).toBeNull();
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('continues with a status failure prompt when HEAD inspection fails', () => {
    const { dir, cleanup } = setupGitRepo();
    const userHome = mkdtempSync(join(tmpdir(), 'context-promotion-home-'));
    try {
      writeFileSync(join(dir, '.git/index'), 'broken', 'utf-8');

      const output = evaluateContextPromotionPostToolUseHook({
        userBasePath: userHome,
        hookInput: {
          hook_event_name: 'PostToolUse',
          cwd: dir,
          tool_name: 'Bash',
          tool_input: { command: 'git commit -m test' },
        },
      });

      expect(output?.decision).toBe('block');
      expect(output?.reason).toContain('could not inspect');
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });
});
