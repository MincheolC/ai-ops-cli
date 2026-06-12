import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../../cli/program.js';
import { recordPcNextPriorities } from '../../features/pc/core.js';

type RepoSetup = {
  dir: string;
  cleanup: () => void;
};

const setupGitRepo = (prefix: string): RepoSetup => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
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

const setupContextRoot = (): RepoSetup => {
  const dir = mkdtempSync(join(tmpdir(), 'pc-context-'));
  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const writePcContext = (params: {
  contextRoot: string;
  workspaceRoot: string;
  includeActiveWorkstream?: boolean;
  includeCurrentEntry?: boolean;
}): void => {
  const workspaceDir = join(params.contextRoot, 'workspaces', 'demo-workspace');
  const includeActiveWorkstream = params.includeActiveWorkstream ?? true;
  const includeCurrentEntry = params.includeCurrentEntry ?? true;
  mkdirSync(join(workspaceDir, 'repos'), { recursive: true });
  mkdirSync(join(workspaceDir, 'workstreams'), { recursive: true });
  mkdirSync(join(params.contextRoot, 'daily'), { recursive: true });
  writeFileSync(
    join(workspaceDir, 'workspace-state.md'),
    [
      '# Demo Workspace',
      '',
      '## 식별',
      '',
      '- 워크스페이스 ID: demo-workspace',
      `- 워크스페이스 루트: ${params.workspaceRoot}`,
      '- 마지막 갱신일: 2026-05-27',
      '',
      '## 활성 Workstream',
      '',
      ...(includeActiveWorkstream ? ['- ID: demo-work', '- 제목: Demo work'] : ['- ID: none']),
      '',
    ].join('\n'),
    'utf-8',
  );
  if (includeCurrentEntry) {
    writeFileSync(
      join(workspaceDir, 'repos', 'demo-repo.md'),
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
  }
  writeFileSync(
    join(workspaceDir, 'workstreams', 'demo-work.md'),
    [
      '# Demo Work',
      '',
      '## 식별',
      '',
      '- ID: demo-work',
      '- 상태: Active',
      '- 마지막 갱신일: 2026-05-27',
      '',
      '## 범위',
      '',
      '- 워크스페이스: demo-workspace',
      '- 엔트리:',
      '  - demo-repo',
      '',
      '## 남은 일',
      '',
      '- 이전 남은 일',
      '',
      '## 다음 첫 행동',
      '',
      '이전 다음 행동',
      '',
      '## 마지막 확인 Commit',
      '',
      '- `demo-repo`: none',
      '',
      '## Handoff',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    join(workspaceDir, 'backlog.md'),
    [
      '# Workstream Index',
      '',
      '## 진행중',
      '',
      '- [ ] `demo-work` Demo work',
      '  - 상태: Active',
      '  - 범위: demo-repo',
      '  - 파일: workstreams/demo-work.md',
      '  - 다음 첫 행동: 이전 행동',
      '',
    ].join('\n'),
    'utf-8',
  );
};

const commitAll = (cwd: string, message: string): void => {
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-m', message], { cwd, stdio: 'ignore' });
};

const head = (cwd: string): string => execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();

const statusShort = (cwd: string): string =>
  execFileSync('git', ['status', '--short'], { cwd, encoding: 'utf-8' }).trim();

const helpFor = (argv: readonly string[]): string => {
  const out: string[] = [];
  const err: string[] = [];
  const program = createProgram();
  program.exitOverride();
  program.configureOutput({
    writeOut: (value) => out.push(value),
    writeErr: (value) => err.push(value),
  });
  try {
    program.parse([...argv], { from: 'user' });
  } catch (error) {
    const commanderError = error as { code?: unknown; exitCode?: unknown };
    const helpExited =
      commanderError.code === 'commander.helpDisplayed' ||
      commanderError.exitCode === 0 ||
      (error instanceof Error && error.message.includes('process.exit unexpectedly called with "0"'));
    if (!helpExited) {
      throw error;
    }
  }
  return `${out.join('')}${err.join('')}`;
};

describe('pc next command help', () => {
  it('exposes pc next as the $pc:next write helper', () => {
    const pcHelp = helpFor(['pc', '--help']);
    expect(pcHelp).toContain('next');
    expect(pcHelp).toContain('$pc:next');
    expect(pcHelp).toContain('ai-ops pc next --cwd <product-repo>');
  });
});

describe('pc next priority recording', () => {
  it('records the first item as next action and the full list as a managed priority snapshot', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      commitAll(context.dir, 'init context');

      const result = recordPcNextPriorities({
        cwd: product.dir,
        contextRoot: context.dir,
        items: [
          'ai-ops pc todo 전용 저장 흐름 설계',
          'pc skill invocation 문서 정리',
          'focused test 추가',
        ],
        basis: '다음 세션에서 바로 이어서 할 우선순위',
        recordedAt: new Date('2026-06-04T01:02:03.000Z'),
      });

      expect(result.committed).toBe(true);
      expect(result.changedFiles).toEqual(
        expect.arrayContaining([
          'workspaces/demo-workspace/backlog.md',
          'workspaces/demo-workspace/workstreams/demo-work.md',
        ]),
      );
      expect(statusShort(product.dir)).toBe('');

      const workstream = readFileSync(join(context.dir, 'workspaces/demo-workspace/workstreams/demo-work.md'), 'utf-8');
      const backlog = readFileSync(join(context.dir, 'workspaces/demo-workspace/backlog.md'), 'utf-8');
      expect(workstream).toContain('ai-ops pc todo 전용 저장 흐름 설계');
      expect(workstream).toContain('- 근거: 다음 세션에서 바로 이어서 할 우선순위');
      expect(workstream).toContain('<!-- ai-ops:pc-next:start -->');
      expect(workstream).toContain('1. ai-ops pc todo 전용 저장 흐름 설계');
      expect(workstream).toContain('3. focused test 추가');
      expect(workstream).toContain('- `demo-repo`: none');
      expect(backlog).toContain('  - 다음 첫 행동: ai-ops pc todo 전용 저장 흐름 설계');
      expect(backlog).toContain('  - 다음 행동 근거: 다음 세션에서 바로 이어서 할 우선순위');
      expect(backlog).toContain('  - 요약: 다음 우선순위 3개 저장.');

      const contextHeadAfterFirstApply = head(context.dir);
      const secondResult = recordPcNextPriorities({
        cwd: product.dir,
        contextRoot: context.dir,
        items: [
          'ai-ops pc todo 전용 저장 흐름 설계',
          'pc skill invocation 문서 정리',
          'focused test 추가',
        ],
        basis: '다음 세션에서 바로 이어서 할 우선순위',
        recordedAt: new Date('2026-06-04T01:02:03.000Z'),
      });
      expect(secondResult.committed).toBe(false);
      expect(secondResult.changedFiles).toEqual([]);
      expect(head(context.dir)).toBe(contextHeadAfterFirstApply);
      expect(statusShort(context.dir)).toBe('');
    } finally {
      product.cleanup();
      context.cleanup();
    }
  });

  it('rejects empty items and blank basis before writing', () => {
    expect(() =>
      recordPcNextPriorities({
        cwd: '/tmp/missing-product',
        contextRoot: '/tmp/missing-context',
        items: [' ', ''],
        basis: '기준',
      }),
    ).toThrow('at least one --item value is required');
    expect(() =>
      recordPcNextPriorities({
        cwd: '/tmp/missing-product',
        contextRoot: '/tmp/missing-context',
        items: ['다음 행동'],
        basis: ' ',
      }),
    ).toThrow('--basis <text> is required');
  });

  it('fails with pc readiness reasons when active workstream or current entry is missing', () => {
    const product = setupGitRepo('pc-product-');
    const noActiveContext = setupContextRoot();
    const noEntryContext = setupContextRoot();
    try {
      writePcContext({
        contextRoot: noActiveContext.dir,
        workspaceRoot: product.dir,
        includeActiveWorkstream: false,
      });
      writePcContext({
        contextRoot: noEntryContext.dir,
        workspaceRoot: product.dir,
        includeCurrentEntry: false,
      });

      expect(() =>
        recordPcNextPriorities({
          cwd: product.dir,
          contextRoot: noActiveContext.dir,
          items: ['다음 행동'],
          basis: '기준',
        }),
      ).toThrow('pc context is not ready: active pc workstream not selected');
      expect(() =>
        recordPcNextPriorities({
          cwd: product.dir,
          contextRoot: noEntryContext.dir,
          items: ['다음 행동'],
          basis: '기준',
        }),
      ).toThrow('pc context is not ready: current repo is not registered in pc workspace');
    } finally {
      product.cleanup();
      noActiveContext.cleanup();
      noEntryContext.cleanup();
    }
  });

  it('rejects recording when managed context files already have unstaged user changes', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      commitAll(context.dir, 'init context');
      const workstreamPath = join(context.dir, 'workspaces/demo-workspace/workstreams/demo-work.md');
      writeFileSync(workstreamPath, `${readFileSync(workstreamPath, 'utf-8')}\n- 사용자 수동 변경\n`, 'utf-8');

      expect(() =>
        recordPcNextPriorities({
          cwd: product.dir,
          contextRoot: context.dir,
          items: ['다음 행동'],
          basis: '기준',
        }),
      ).toThrow('pre-existing changes in managed files: workspaces/demo-workspace/workstreams/demo-work.md');
    } finally {
      product.cleanup();
      context.cleanup();
    }
  });
});
