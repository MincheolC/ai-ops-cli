import * as p from '@clack/prompts';
import { resolveBasePath, resolvePersonalContextRoot } from '@/shared/command-paths.js';
import { applyPcDoneDraft, createPcDoneDraft, fillPcDoneDraft } from './done.js';
import type { FillPcDoneDraftInput } from './done.js';
import { recordPcNextPriorities } from './next.js';
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

export type PcDoneFillOptions = {
  draft?: string;
  completed?: string[];
  verification?: string[];
  remaining?: string[];
  nextAction?: string;
  nextActionEvidence?: string;
  blocker?: string[];
  durableContextDelta?: string;
  clearDurableContextDelta?: boolean;
  apply?: boolean;
};

export type PcNextOptions = {
  cwd?: string;
  item?: string[];
  basis?: string;
};

const reportPcError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  p.log.error(message);
  process.exitCode = 1;
};

const resolveCommandCwd = (cwd: string | undefined): string => cwd ?? resolveBasePath();

const normalizeOptionList = (values: readonly string[] | undefined): string[] | undefined => {
  if (values === undefined) {
    return undefined;
  }
  return values.map((value) => value.trim()).filter((value) => value.length > 0);
};

const listInput = (values: readonly string[] | undefined): string[] | undefined => {
  const normalized = normalizeOptionList(values);
  return normalized && normalized.length > 0 ? normalized : undefined;
};

const buildFillInput = (opts: PcDoneFillOptions): FillPcDoneDraftInput => {
  const completed = listInput(opts.completed);
  const verification = listInput(opts.verification);
  const remaining = listInput(opts.remaining);
  const blockers = listInput(opts.blocker);
  return {
    ...(completed !== undefined ? { completed } : {}),
    ...(verification !== undefined ? { verification } : {}),
    ...(remaining !== undefined ? { remaining } : {}),
    ...(opts.nextAction !== undefined ? { nextAction: opts.nextAction } : {}),
    ...(opts.nextActionEvidence !== undefined ? { nextActionEvidence: opts.nextActionEvidence } : {}),
    ...(blockers !== undefined ? { blockers } : {}),
    ...(opts.clearDurableContextDelta
      ? { durableContextDelta: null }
      : opts.durableContextDelta !== undefined
        ? { durableContextDelta: opts.durableContextDelta }
        : {}),
  };
};

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

export const pcNextCommand = async (opts: PcNextOptions = {}): Promise<void> => {
  p.intro('ai-ops pc next');
  try {
    if (!opts.basis) {
      throw new Error('--basis <text> is required');
    }
    const result = recordPcNextPriorities({
      cwd: resolveCommandCwd(opts.cwd),
      contextRoot: resolvePersonalContextRoot(),
      items: opts.item ?? [],
      basis: opts.basis,
    });
    if (result.committed) {
      p.log.success(`context commit created: ${result.commitHash ?? 'unknown'}`);
    } else {
      p.log.info('변경 없음: 같은 다음 우선순위가 이미 반영되어 있습니다.');
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
  p.outro('ai-ops pc next 완료');
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
        '1. Fill the AI fields with ai-ops pc done fill --draft <draft-path>.',
        '2. Do not edit the draft JSON directly when the CLI fill command can express the handoff.',
        `3. Apply with: ai-ops pc done fill --draft ${result.draftPath} --apply ...`,
      ].join('\n'),
    );
  } catch (error) {
    reportPcError(error);
  }
  p.outro('ai-ops pc done draft 완료');
};

export const pcDoneFillCommand = async (opts: PcDoneFillOptions): Promise<void> => {
  p.intro('ai-ops pc done fill');
  try {
    if (!opts.draft) {
      throw new Error('--draft <draft-path> is required');
    }
    const contextRoot = resolvePersonalContextRoot();
    const fillResult = fillPcDoneDraft({
      draftPath: opts.draft,
      contextRoot,
      input: buildFillInput(opts),
    });
    p.log.success(`draft filled: ${fillResult.draftPath}`);
    p.log.info(`changed: ${fillResult.changed ? 'yes' : 'no'}`);

    if (opts.apply) {
      const applyResult = applyPcDoneDraft({
        draftPath: opts.draft,
        contextRoot,
      });
      if (applyResult.committed) {
        p.log.success(`context commit created: ${applyResult.commitHash ?? 'unknown'}`);
      } else {
        p.log.info('변경 없음: 같은 product HEAD handoff가 이미 반영되어 있습니다.');
      }
      p.log.info(
        [
          `context root: ${applyResult.contextRoot}`,
          `changed files: ${applyResult.changedFiles.length > 0 ? applyResult.changedFiles.join(', ') : 'none'}`,
        ].join('\n'),
      );
    }
  } catch (error) {
    reportPcError(error);
  }
  p.outro('ai-ops pc done fill 완료');
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
