import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { INTEGRATION_ID } from '../schemas/index.js';
import { evaluateIntegrationPostToolUseWorkflows } from '../../features/integrations/post-tool-use-dispatcher.js';

const setupGitRepo = (): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'integration-dispatcher-repo-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  mkdirSync(join(dir, '.ai-ops'), { recursive: true });
  writeFileSync(join(dir, '.ai-ops/context-layer.json'), '{"schemaVersion":1}\n', 'utf-8');
  writeFileSync(join(dir, 'tracked.txt'), 'initial\n', 'utf-8');
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const writePcContext = (params: { contextRoot: string; workspaceRoot: string }): void => {
  const workspaceDir = join(params.contextRoot, 'workspaces/demo-workspace');
  mkdirSync(join(workspaceDir, 'repos'), { recursive: true });
  mkdirSync(join(workspaceDir, 'workstreams'), { recursive: true });
  writeFileSync(
    join(workspaceDir, 'workspace-state.md'),
    [
      '# Demo Workspace',
      '',
      '## 식별',
      '',
      '- 워크스페이스 ID: demo-workspace',
      `- 워크스페이스 루트: ${params.workspaceRoot}`,
      '',
      '## 활성 Workstream',
      '',
      '- ID: demo-work',
      '- 제목: Demo work',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    join(workspaceDir, 'repos/demo-repo.md'),
    [
      '# Demo Repo',
      '',
      '## 식별',
      '',
      '- 엔트리 ID: demo-repo',
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
    join(workspaceDir, 'workstreams/demo-work.md'),
    [
      '# Demo Work',
      '',
      '## 식별',
      '',
      '- ID: demo-work',
      '- 상태: Active',
      '',
      '## 범위',
      '',
      '- 워크스페이스: demo-workspace',
      '- 엔트리:',
      '  - demo-repo',
      '',
      '## 마지막 확인 Commit',
      '',
      '- `demo-repo`: none',
      '',
    ].join('\n'),
    'utf-8',
  );
};

describe('integration PostToolUse dispatcher', () => {
  it('merges context-promotion and pc continuations in deterministic order', () => {
    const { dir, cleanup } = setupGitRepo();
    const userBasePath = mkdtempSync(join(tmpdir(), 'integration-dispatcher-home-'));
    const contextRoot = mkdtempSync(join(tmpdir(), 'integration-dispatcher-pc-'));
    try {
      writePcContext({ contextRoot, workspaceRoot: dir });
      writeFileSync(join(dir, 'tracked.txt'), 'changed\n', 'utf-8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: dir });
      execFileSync('git', ['commit', '-m', 'work'], { cwd: dir, stdio: 'ignore' });

      const output = evaluateIntegrationPostToolUseWorkflows({
        userBasePath,
        contextRoot,
        workflows: [INTEGRATION_ID.CONTEXT_PROMOTION, INTEGRATION_ID.PC],
        hookInput: {
          hook_event_name: 'PostToolUse',
          cwd: dir,
          tool_name: 'Bash',
          tool_input: { command: 'git commit -m work' },
          tool_response: '[main 1234567] work\n 1 file changed, 1 insertion(+), 1 deletion(-)\n',
        },
      });

      expect(output?.decision).toBe('block');
      const reason = output?.reason ?? '';
      expect(reason).toContain('Multiple ai-ops post-commit workflows');
      expect(reason.indexOf('Context Promotion Review')).toBeLessThan(reason.indexOf('$pc:done'));
      expect(reason).toContain('context-promotion-review');
      expect(reason).toContain('ai-ops pc done draft --from-hook --cwd');
    } finally {
      rmSync(userBasePath, { recursive: true, force: true });
      rmSync(contextRoot, { recursive: true, force: true });
      cleanup();
    }
  });
});
