import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizePath } from './markdown.js';
import { getPcHandoffStatus, readGitHead, resolveGitRoot } from './status.js';
import {
  assertFilledPcDoneDraft,
  parsePcDoneDraft,
  PC_DONE_DRAFT_SCHEMA_VERSION,
  type PcDoneDraft,
} from './done-draft.js';
import {
  assertCleanStagingArea,
  assertNoPreExistingManagedFileChanges,
  commitContextChanges,
} from './done-git.util.js';
import {
  buildPcDoneContextFileFallbacks,
  buildPcDoneContextFileUpdates,
  buildPcDoneDraftMarkerUpdate,
} from './done-markdown.logic.js';
import { assertInside, assertProductHeadMatchesDraft, assertStatusMatchesDraft, pathsEqual } from './done-preflight.logic.js';
import type { ApplyContext, ApplyPcDoneDraftResult, ContextFileContents, CreatePcDoneDraftResult } from './done-types.js';

export { PC_DONE_DRAFT_SCHEMA_VERSION, type PcDoneDraft };
export type { ApplyPcDoneDraftResult, CreatePcDoneDraftResult } from './done-types.js';

const ensureTrailingNewline = (content: string): string => `${content.trimEnd()}\n`;

const readText = (filePath: string, fallback: string): string =>
  existsSync(filePath) ? readFileSync(filePath, 'utf-8') : fallback;

const writeIfChanged = (filePath: string, content: string): boolean => {
  const nextContent = ensureTrailingNewline(content);
  const previousContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : null;
  if (previousContent === nextContent) {
    return false;
  }
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, nextContent, 'utf-8');
  return true;
};

const timestampForFile = (date: Date): string => date.toISOString().replace(/[:.]/g, '').replace('Z', 'Z');

const dateFromIso = (value: string): string => {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
};

const readPcDoneContextFileContents = (ctx: ApplyContext): ContextFileContents => {
  const fallbacks = buildPcDoneContextFileFallbacks(ctx);
  return {
    workstream: readText(ctx.workstreamPath, fallbacks.workstream),
    workspaceState: readText(ctx.workspaceStatePath, fallbacks.workspaceState),
    backlog: readText(ctx.backlogPath, fallbacks.backlog),
    daily: readText(ctx.dailyPath, fallbacks.daily),
  };
};

const writePcDoneUpdates = (updates: readonly { readonly path: string; readonly content: string }[]): void => {
  for (const update of updates) {
    writeIfChanged(update.path, update.content);
  }
};

export const createPcDoneDraft = (params: {
  cwd: string;
  contextRoot: string;
  generatedAt?: Date;
}): CreatePcDoneDraftResult => {
  const cwd = normalizePath(params.cwd);
  const contextRoot = normalizePath(params.contextRoot);
  const status = getPcHandoffStatus({ cwd, contextRoot });
  if (!status.ready) {
    throw new Error(`pc context is not ready: ${status.skipReason ?? 'unknown reason'}`);
  }
  if (!status.workspaceId || !status.activeWorkstreamId || !status.currentEntryId || !status.activeWorkstreamPath) {
    throw new Error('pc context status is incomplete');
  }

  const productGitRoot = resolveGitRoot(cwd);
  if (!productGitRoot) {
    throw new Error('current pc entry does not have a git root');
  }
  const productHead = readGitHead(productGitRoot);
  if (!productHead) {
    throw new Error('current pc entry does not have a HEAD commit');
  }

  const generatedAt = params.generatedAt ?? new Date();
  const workspaceDir = dirname(dirname(status.activeWorkstreamPath));
  const draftDir = join(workspaceDir, '.ai-ops', 'drafts');
  const draftPath = join(draftDir, `pc-done-${timestampForFile(generatedAt)}.json`);
  const draft: PcDoneDraft = {
    schemaVersion: PC_DONE_DRAFT_SCHEMA_VERSION,
    workspaceId: status.workspaceId,
    workstreamId: status.activeWorkstreamId,
    currentEntryId: status.currentEntryId,
    contextRoot,
    workspaceDir,
    productGitRoot,
    productHead,
    lastConfirmedCommitHash: status.lastConfirmedCommitHash,
    generatedAt: generatedAt.toISOString(),
    completed: [],
    verification: [],
    remaining: [],
    nextAction: '',
    nextActionEvidence: '',
    blockers: [],
    durableContextDelta: null,
  };

  mkdirSync(draftDir, { recursive: true });
  writeFileSync(draftPath, JSON.stringify(draft, null, 2) + '\n', 'utf-8');
  return { draftPath, draft };
};

export const readPcDoneDraft = (draftPath: string): PcDoneDraft => {
  const parsed: unknown = JSON.parse(readFileSync(draftPath, 'utf-8'));
  return parsePcDoneDraft(parsed);
};

export const applyPcDoneDraft = (params: {
  draftPath: string;
  contextRoot: string;
}): ApplyPcDoneDraftResult => {
  const contextRoot = normalizePath(params.contextRoot);
  const draftPath = normalizePath(params.draftPath);
  assertInside({ parent: contextRoot, child: draftPath, label: 'draft path' });

  const draft = readPcDoneDraft(draftPath);
  assertFilledPcDoneDraft(draft);
  if (normalizePath(draft.contextRoot) !== contextRoot) {
    throw new Error(`context root mismatch: draft=${draft.contextRoot}, current=${contextRoot}`);
  }
  assertInside({ parent: contextRoot, child: draft.workspaceDir, label: 'workspace directory' });

  const contextGitRoot = resolveGitRoot(contextRoot);
  if (!contextGitRoot || !pathsEqual(contextGitRoot, contextRoot)) {
    throw new Error(`pc context root is not a git repo: ${contextRoot}`);
  }

  const verified = assertStatusMatchesDraft(draft, contextRoot);
  assertProductHeadMatchesDraft(draft);

  const date = dateFromIso(draft.generatedAt);
  const ctx: ApplyContext = {
    draft,
    contextRoot,
    workspaceDir: verified.workspaceDir,
    workstreamPath: verified.workstreamPath,
    workspaceStatePath: join(verified.workspaceDir, 'workspace-state.md'),
    backlogPath: join(verified.workspaceDir, 'backlog.md'),
    dailyPath: join(contextRoot, 'daily', `${date}.md`),
    draftPath,
    date,
    shortHead: draft.productHead.slice(0, 7),
  };
  const updates = [
    ...buildPcDoneContextFileUpdates(ctx, readPcDoneContextFileContents(ctx)),
    buildPcDoneDraftMarkerUpdate(ctx, new Date().toISOString()),
  ];
  const allowedPaths = updates.map((update) => update.path);
  for (const filePath of allowedPaths) {
    assertInside({ parent: contextRoot, child: filePath, label: 'managed file' });
  }
  assertCleanStagingArea(contextRoot);
  assertNoPreExistingManagedFileChanges({
    contextRoot,
    allowedPaths,
    allowedUntrackedPaths: [draftPath],
  });
  writePcDoneUpdates(updates);

  const result = commitContextChanges({
    contextRoot,
    allowedPaths,
    message: `Record handoff: ${draft.workspaceId} ${draft.workstreamId}`,
  });

  return {
    contextRoot,
    changedFiles: result.changedFiles,
    committed: result.committed,
    commitHash: result.commitHash,
  };
};
