import * as p from '@clack/prompts';
import { resolveBasePath, resolvePersonalContextRoot } from '@/shared/command-paths.js';
import { applyPcDoneDraft, createPcDoneDraft } from './done.js';
import { getPcHandoffStatus, readGitHead, resolveGitRoot } from './status.js';

export type PcStatusOptions = {
  cwd?: string;
};

export type PcDoneDraftOptions = {
  cwd?: string;
  fromHook?: boolean;
};

export type PcDoneApplyOptions = {
  draft?: string;
};

const reportPcError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

const resolveCommandCwd = (cwd: string | undefined): string => cwd ?? resolveBasePath();

export const pcStatusCommand = async (opts: PcStatusOptions = {}): Promise<void> => {
  p.intro('ai-ops pc status');
  try {
    const cwd = resolveCommandCwd(opts.cwd);
    const contextRoot = resolvePersonalContextRoot();
    const status = getPcHandoffStatus({ cwd, contextRoot });
    const gitRoot = resolveGitRoot(cwd);
    const head = gitRoot ? readGitHead(gitRoot) : null;
    const needsHandoff = status.ready && head !== null && status.lastConfirmedCommitHash !== head;
    p.log.info(
      [
        `pc context ready: ${status.ready ? 'yes' : 'no'}`,
        `pc skip reason: ${status.skipReason ?? 'none'}`,
        `cwd: ${status.cwd}`,
        `product git root: ${gitRoot ?? 'not found'}`,
        `product HEAD: ${head ?? 'not found'}`,
        `pc context root: ${status.contextRoot}`,
        `pc workspace: ${status.workspaceId ?? 'not found'}`,
        `pc workspace root: ${status.workspaceRoot ?? 'not found'}`,
        `pc active workstream: ${status.activeWorkstreamId ?? 'not found'}`,
        `pc current entry: ${status.currentEntryId ?? 'not found'}`,
        `pc last confirmed commit: ${status.lastConfirmedCommitHash ?? 'not found'}`,
        `pc done needed: ${needsHandoff ? 'yes' : 'no'}`,
      ].join('\n'),
    );
  } catch (error) {
    reportPcError(error);
  }
  p.outro('ai-ops pc status 완료');
};

export const pcDoneDraftCommand = async (opts: PcDoneDraftOptions = {}): Promise<void> => {
  p.intro('ai-ops pc done draft');
  try {
    const result = createPcDoneDraft({
      cwd: resolveCommandCwd(opts.cwd),
      contextRoot: resolvePersonalContextRoot(),
    });
    p.log.success(`draft created: ${result.draftPath}`);
    p.log.info(
      [
        'AI fill protocol:',
        '1. Open the draft JSON and fill completed, verification, remaining, nextAction, nextActionEvidence, blockers, and durableContextDelta only when durable context changed.',
        '2. Do not create temporary JS scripts to edit ~/.personal-project-contexts directly.',
        `3. Apply with: ai-ops pc done apply --draft ${result.draftPath}`,
      ].join('\n'),
    );
  } catch (error) {
    reportPcError(error);
  }
  p.outro('ai-ops pc done draft 완료');
};

export const pcDoneApplyCommand = async (opts: PcDoneApplyOptions): Promise<void> => {
  p.intro('ai-ops pc done apply');
  try {
    if (!opts.draft) {
      throw new Error('--draft <draft-path> is required');
    }
    const result = applyPcDoneDraft({
      draftPath: opts.draft,
      contextRoot: resolvePersonalContextRoot(),
    });
    if (result.committed) {
      p.log.success(`context commit created: ${result.commitHash ?? 'unknown'}`);
    } else {
      p.log.info('변경 없음: 같은 product HEAD handoff가 이미 반영되어 있습니다.');
    }
    p.log.info(
      [
        `context root: ${result.contextRoot}`,
        `changed files: ${result.changedFiles.length > 0 ? result.changedFiles.join(', ') : 'none'}`,
      ].join('\n'),
    );
  } catch (error) {
    reportPcError(error);
  }
  p.outro('ai-ops pc done apply 완료');
};
