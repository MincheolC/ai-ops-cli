import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { evaluatePcPostToolUseHook, getPcHandoffStatus } from '../pc-integration.js';

const setupGitRepo = (): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'pc-integration-repo-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  writeFileSync(join(dir, 'tracked.txt'), 'initial\n', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });

  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const writePcContext = (params: {
  contextRoot: string;
  workspaceRoot: string;
  activeWorkstreamId?: string;
  entryId?: string;
  scopeEntryIds?: readonly string[];
  lastConfirmedCommitHash?: string;
}): void => {
  const workspaceId = 'demo-workspace';
  const entryId = params.entryId ?? 'demo-repo';
  const activeWorkstreamId = params.activeWorkstreamId ?? 'integration-work';
  const workspaceDir = join(params.contextRoot, 'workspaces', workspaceId);
  mkdirSync(join(workspaceDir, 'repos'), { recursive: true });
  mkdirSync(join(workspaceDir, 'workstreams'), { recursive: true });
  writeFileSync(
    join(workspaceDir, 'workspace-state.md'),
    [
      '# Demo Workspace',
      '',
      '## 식별',
      '',
      `- 워크스페이스 ID: ${workspaceId}`,
      `- 워크스페이스 루트: ${params.workspaceRoot}`,
      '',
      '## 활성 Workstream',
      '',
      `- ID: ${activeWorkstreamId}`,
      '- 제목: Integration work',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    join(workspaceDir, 'repos', `${entryId}.md`),
    [
      '# Demo Repo',
      '',
      '## 식별',
      '',
      `- 엔트리 ID: ${entryId}`,
      `- 경로: ${params.workspaceRoot}`,
      '',
      '## 버전 관리',
      '',
      '- 버전 관리: git',
      `- Git 루트: ${params.workspaceRoot}`,
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    join(workspaceDir, 'workstreams', `${activeWorkstreamId}.md`),
    [
      '# Integration work',
      '',
      '## 식별',
      '',
      `- ID: ${activeWorkstreamId}`,
      '- 상태: Active',
      '',
      '## 범위',
      '',
      `- 워크스페이스: ${workspaceId}`,
      '- 엔트리:',
      ...(params.scopeEntryIds ?? [entryId]).map((id) => `  - ${id}`),
      '',
      '## 마지막 확인 Commit',
      '',
      `- \`${entryId}\`: ${params.lastConfirmedCommitHash ?? 'none'}`,
      '',
    ].join('\n'),
    'utf-8',
  );
};

describe('pc integration preflight', () => {
  it('requires a matching context root, active workstream, registered repo, and scope match', () => {
    const { dir, cleanup } = setupGitRepo();
    const contextRoot = mkdtempSync(join(tmpdir(), 'pc-context-'));
    try {
      expect(getPcHandoffStatus({ cwd: dir, contextRoot: join(contextRoot, 'missing') }).ready).toBe(false);

      writePcContext({
        contextRoot,
        workspaceRoot: dir,
        scopeEntryIds: ['other-repo'],
      });
      const scopedOut = getPcHandoffStatus({ cwd: dir, contextRoot });
      expect(scopedOut.ready).toBe(false);
      expect(scopedOut.skipReason).toBe('current repo is outside the active pc workstream scope');

      writePcContext({
        contextRoot,
        workspaceRoot: dir,
        scopeEntryIds: ['demo-repo'],
      });
      const ready = getPcHandoffStatus({ cwd: dir, contextRoot });
      expect(ready.ready).toBe(true);
      expect(ready.workspaceId).toBe('demo-workspace');
      expect(ready.activeWorkstreamId).toBe('integration-work');
      expect(ready.currentEntryId).toBe('demo-repo');
    } finally {
      rmSync(contextRoot, { recursive: true, force: true });
      cleanup();
    }
  });

  it('prompts for $pc:done only after a successful git commit in a prepared pc context', () => {
    const { dir, cleanup } = setupGitRepo();
    const contextRoot = mkdtempSync(join(tmpdir(), 'pc-context-'));
    try {
      writePcContext({ contextRoot, workspaceRoot: dir });
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'work'], { cwd: dir, stdio: 'ignore' });

      const output = evaluatePcPostToolUseHook({
        contextRoot,
        hookInput: {
          hook_event_name: 'PostToolUse',
          cwd: dir,
          tool_name: 'Bash',
          tool_input: { command: 'git commit -m work' },
          tool_response: '[main 1234567] work\n 1 file changed, 1 insertion(+), 1 deletion(-)\n',
        },
      });

      expect(output?.decision).toBe('block');
      expect(output?.reason).toContain('$pc:done');
      expect(output?.reason).toContain('Do not create or initialize a new pc context');
      expect(output?.reason).toContain('already records this HEAD as the last confirmed commit');
      expect(output?.reason).toContain(contextRoot);
      expect(output?.reason).toContain('active workstream: integration-work');
      expect(output?.hookSpecificOutput.hookEventName).toBe('PostToolUse');

      expect(
        evaluatePcPostToolUseHook({
          contextRoot,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m work' },
            tool_response: 'nothing to commit, working tree clean\n',
          },
        }),
      ).toBeNull();
    } finally {
      rmSync(contextRoot, { recursive: true, force: true });
      cleanup();
    }
  });

  it('skips when the active workstream already recorded the current HEAD', () => {
    const { dir, cleanup } = setupGitRepo();
    const contextRoot = mkdtempSync(join(tmpdir(), 'pc-context-'));
    try {
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'work'], { cwd: dir, stdio: 'ignore' });
      const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf-8' }).trim();
      writePcContext({
        contextRoot,
        workspaceRoot: dir,
        lastConfirmedCommitHash: head,
      });

      expect(
        evaluatePcPostToolUseHook({
          contextRoot,
          hookInput: {
            hook_event_name: 'PostToolUse',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m work' },
            tool_response: '[main 1234567] work\n 1 file changed, 1 insertion(+), 1 deletion(-)\n',
          },
        }),
      ).toBeNull();
      expect(getPcHandoffStatus({ cwd: dir, contextRoot }).lastConfirmedCommitHash).toBe(head);
    } finally {
      rmSync(contextRoot, { recursive: true, force: true });
      cleanup();
    }
  });
});
