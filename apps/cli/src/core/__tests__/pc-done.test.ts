import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../../cli/program.js';
import {
  applyPcDoneDraft,
  createPcDoneDraft,
  PC_DONE_DRAFT_SCHEMA_VERSION,
  readPcDoneDraft,
} from '../../features/pc/core.js';

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
  lastConfirmedCommitHash?: string;
}): void => {
  const workspaceId = 'demo-workspace';
  const workstreamId = 'demo-work';
  const entryId = 'demo-repo';
  const workspaceDir = join(params.contextRoot, 'workspaces', workspaceId);
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
      `- 워크스페이스 ID: ${workspaceId}`,
      `- 워크스페이스 루트: ${params.workspaceRoot}`,
      '- 마지막 갱신일: 2026-05-27',
      '',
      '## 활성 Workstream',
      '',
      `- ID: ${workstreamId}`,
      '- 제목: Demo work',
      '',
      '## 마지막 Handoff',
      '',
      '- 날짜: 2026-05-27',
      '- 요약: 이전 handoff',
      '- 다음 첫 행동: 이전 행동',
      '',
      '## 장기 결정',
      '',
      '- 2026-05-27: 기존 결정',
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
    join(workspaceDir, 'workstreams', `${workstreamId}.md`),
    [
      '# Demo Work',
      '',
      '## 식별',
      '',
      `- ID: ${workstreamId}`,
      '- 상태: Active',
      '- 마지막 갱신일: 2026-05-27',
      '',
      '## 범위',
      '',
      `- 워크스페이스: ${workspaceId}`,
      '- 엔트리:',
      `  - ${entryId}`,
      '',
      '## 다음 첫 행동',
      '',
      '이전 다음 행동',
      '',
      '## 마지막 확인 Commit',
      '',
      `- \`${entryId}\`: ${params.lastConfirmedCommitHash ?? 'none'}`,
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
      `- [ ] \`${workstreamId}\` Demo work`,
      '  - 상태: Active',
      `  - 범위: ${entryId}`,
      `  - 파일: workstreams/${workstreamId}.md`,
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

const gitRoot = (cwd: string): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf-8' }).trim();

const statusShort = (cwd: string): string =>
  execFileSync('git', ['status', '--short'], { cwd, encoding: 'utf-8' }).trim();

const fillDraft = (draftPath: string, patch: Partial<ReturnType<typeof readPcDoneDraft>> = {}): void => {
  const draft = readPcDoneDraft(draftPath);
  writeFileSync(
    draftPath,
    JSON.stringify(
      {
        ...draft,
        completed: ['새 기능 구현'],
        verification: ['npm test --workspace=apps/cli -- pc 통과'],
        remaining: ['실제 사용자 repo에서 smoke 확인'],
        nextAction: '실제 pc hook에서 draft/apply smoke를 실행한다.',
        nextActionEvidence: 'product HEAD와 active workstream이 draft metadata와 일치한다.',
        blockers: [],
        durableContextDelta: 'pc handoff는 draft/apply 프로토콜을 사용한다.',
        ...patch,
      },
      null,
      2,
    ) + '\n',
    'utf-8',
  );
};

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

describe('pc done command help', () => {
  it('exposes pc status and draft/apply protocol for Codex', () => {
    const pcHelp = helpFor(['pc', '--help']);
    expect(pcHelp).toContain('status');
    expect(pcHelp).toContain('done');
    expect(pcHelp).toContain('$pc:todo');
    expect(pcHelp).toContain('draft --cwd <product-repo>');
    expect(pcHelp).toContain('AI fills the generated JSON draft');

    const doneHelp = helpFor(['pc', 'done', '--help']);
    expect(doneHelp).toContain('draft');
    expect(doneHelp).toContain('apply');
    expect(doneHelp).toContain('durableContextDelta');
    expect(doneHelp).toContain('ai-ops pc done apply --draft');
  });
});

describe('pc done draft/apply', () => {
  it('creates a draft with pc metadata under the workspace draft directory', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      const result = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:03.000Z'),
      });
      const raw = JSON.parse(readFileSync(result.draftPath, 'utf-8')) as Record<string, unknown>;

      expect(result.draftPath).toBe(
        join(context.dir, 'workspaces/demo-workspace/.ai-ops/drafts/pc-done-2026-05-28T010203000Z.json'),
      );
      expect(raw.schemaVersion).toBe(PC_DONE_DRAFT_SCHEMA_VERSION);
      expect(raw.workspaceId).toBe('demo-workspace');
      expect(raw.workstreamId).toBe('demo-work');
      expect(raw.currentEntryId).toBe('demo-repo');
      expect(raw.contextRoot).toBe(context.dir);
      expect(raw.productGitRoot).toBe(gitRoot(product.dir));
      expect(raw.productHead).toBe(head(product.dir));
      expect(raw.completed).toEqual([]);
      expect(raw.nextAction).toBe('');
      expect(raw.durableContextDelta).toBeNull();
    } finally {
      product.cleanup();
      context.cleanup();
    }
  });

  it('rejects invalid drafts, path escapes, product HEAD mismatch, and workspace mismatch', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    const outside = mkdtempSync(join(tmpdir(), 'pc-outside-'));
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      commitAll(context.dir, 'init context');

      const invalidDraftPath = join(context.dir, 'invalid.json');
      writeFileSync(invalidDraftPath, JSON.stringify({ schemaVersion: PC_DONE_DRAFT_SCHEMA_VERSION }), 'utf-8');
      expect(() => applyPcDoneDraft({ draftPath: invalidDraftPath, contextRoot: context.dir })).toThrow();

      const outsideDraftPath = join(outside, 'draft.json');
      writeFileSync(outsideDraftPath, '{}', 'utf-8');
      expect(() => applyPcDoneDraft({ draftPath: outsideDraftPath, contextRoot: context.dir })).toThrow(
        'draft path must be inside',
      );
      const symlinkDraftDir = join(context.dir, 'symlink-drafts');
      symlinkSync(outside, symlinkDraftDir, 'dir');
      expect(() => applyPcDoneDraft({ draftPath: join(symlinkDraftDir, 'draft.json'), contextRoot: context.dir }))
        .toThrow('draft path must be inside');

      const draft = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:03.000Z'),
      });
      fillDraft(draft.draftPath);
      writeFileSync(join(product.dir, 'tracked.txt'), 'changed\n', 'utf-8');
      execFileSync('git', ['add', 'tracked.txt'], { cwd: product.dir });
      execFileSync('git', ['commit', '-m', 'new head'], { cwd: product.dir, stdio: 'ignore' });
      expect(() => applyPcDoneDraft({ draftPath: draft.draftPath, contextRoot: context.dir })).toThrow(
        'product HEAD changed',
      );

      const mismatchDraft = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:04.000Z'),
      });
      fillDraft(mismatchDraft.draftPath, { workspaceId: 'other-workspace' });
      expect(() => applyPcDoneDraft({ draftPath: mismatchDraft.draftPath, contextRoot: context.dir })).toThrow(
        'workspace mismatch',
      );

      const workspaceDirMismatchDraft = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:05.000Z'),
      });
      fillDraft(workspaceDirMismatchDraft.draftPath, {
        workspaceDir: join(context.dir, 'workspaces', 'other-workspace'),
      });
      expect(() => applyPcDoneDraft({ draftPath: workspaceDirMismatchDraft.draftPath, contextRoot: context.dir }))
        .toThrow('workspace directory mismatch');
    } finally {
      rmSync(outside, { recursive: true, force: true });
      product.cleanup();
      context.cleanup();
    }
  });

  it('updates only context files, commits the context repo, and is idempotent for the same product HEAD', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      commitAll(context.dir, 'init context');

      const draft = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:03.000Z'),
      });
      fillDraft(draft.draftPath);
      expect(statusShort(product.dir)).toBe('');

      const firstApply = applyPcDoneDraft({ draftPath: draft.draftPath, contextRoot: context.dir });
      expect(firstApply.committed).toBe(true);
      expect(firstApply.changedFiles).toEqual(
        expect.arrayContaining([
          'workspaces/demo-workspace/workspace-state.md',
          'workspaces/demo-workspace/backlog.md',
          'workspaces/demo-workspace/workstreams/demo-work.md',
          'daily/2026-05-28.md',
          'workspaces/demo-workspace/.ai-ops/drafts/pc-done-2026-05-28T010203000Z.json',
        ]),
      );
      expect(firstApply.changedFiles.every((filePath) => !filePath.startsWith('..'))).toBe(true);
      expect(statusShort(product.dir)).toBe('');

      const workstream = readFileSync(join(context.dir, 'workspaces/demo-workspace/workstreams/demo-work.md'), 'utf-8');
      const daily = readFileSync(join(context.dir, 'daily/2026-05-28.md'), 'utf-8');
      const workspace = readFileSync(join(context.dir, 'workspaces/demo-workspace/workspace-state.md'), 'utf-8');
      expect(workstream).toContain(`- \`demo-repo\`: ${head(product.dir)}`);
      expect(workstream.match(/ai-ops:pc-done:/g)?.length).toBe(2);
      expect(daily.match(/ai-ops:pc-done:demo-workspace/g)?.length).toBe(2);
      expect(workspace).toContain('pc handoff는 draft/apply 프로토콜을 사용한다.');

      const contextHeadAfterFirstApply = head(context.dir);
      const secondApply = applyPcDoneDraft({ draftPath: draft.draftPath, contextRoot: context.dir });
      expect(secondApply.committed).toBe(false);
      expect(secondApply.changedFiles).toEqual([]);
      expect(head(context.dir)).toBe(contextHeadAfterFirstApply);
      expect(statusShort(context.dir)).toBe('');
      expect(
        readFileSync(join(context.dir, 'workspaces/demo-workspace/workstreams/demo-work.md'), 'utf-8').match(
          /ai-ops:pc-done:/g,
        )?.length,
      ).toBe(2);
    } finally {
      product.cleanup();
      context.cleanup();
    }
  });

  it('rejects apply when managed context files already have unstaged user changes', () => {
    const product = setupGitRepo('pc-product-');
    const context = setupContextRoot();
    try {
      writePcContext({ contextRoot: context.dir, workspaceRoot: product.dir });
      commitAll(context.dir, 'init context');

      const draft = createPcDoneDraft({
        cwd: product.dir,
        contextRoot: context.dir,
        generatedAt: new Date('2026-05-28T01:02:03.000Z'),
      });
      fillDraft(draft.draftPath);
      const workspaceStatePath = join(context.dir, 'workspaces/demo-workspace/workspace-state.md');
      writeFileSync(workspaceStatePath, `${readFileSync(workspaceStatePath, 'utf-8')}\n- 사용자 수동 변경\n`, 'utf-8');

      expect(() => applyPcDoneDraft({ draftPath: draft.draftPath, contextRoot: context.dir })).toThrow(
        'pre-existing changes in managed files: workspaces/demo-workspace/workspace-state.md',
      );
    } finally {
      product.cleanup();
      context.cleanup();
    }
  });
});
