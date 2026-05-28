import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { z } from 'zod';
import { extractSection, normalizePath, pathContains } from './markdown.js';
import { getPcHandoffStatus, readGitHead, resolveGitRoot } from './status.js';

export const PC_DONE_DRAFT_SCHEMA_VERSION = 'pc-done-draft.v1';

const FILLED_DRAFT_ERROR =
  'draft must be filled before apply: nextAction and nextActionEvidence are required';

const PcDoneDraftSchema = z
  .object({
    schemaVersion: z.literal(PC_DONE_DRAFT_SCHEMA_VERSION),
    workspaceId: z.string().min(1),
    workstreamId: z.string().min(1),
    currentEntryId: z.string().min(1),
    contextRoot: z.string().min(1),
    workspaceDir: z.string().min(1),
    productGitRoot: z.string().min(1),
    productHead: z.string().regex(/^[a-f0-9]{40}$/),
    lastConfirmedCommitHash: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
    generatedAt: z.string().min(1),
    completed: z.array(z.string()),
    verification: z.array(z.string()),
    remaining: z.array(z.string()),
    nextAction: z.string(),
    nextActionEvidence: z.string(),
    blockers: z.array(z.string()),
    durableContextDelta: z.string().nullable().optional(),
    appliedAt: z.string().optional(),
  })
  .strict();

export type PcDoneDraft = z.infer<typeof PcDoneDraftSchema>;

export type CreatePcDoneDraftResult = {
  draftPath: string;
  draft: PcDoneDraft;
};

export type ApplyPcDoneDraftResult = {
  contextRoot: string;
  changedFiles: string[];
  committed: boolean;
  commitHash: string | null;
};

type ApplyContext = {
  draft: PcDoneDraft;
  contextRoot: string;
  workspaceDir: string;
  workstreamPath: string;
  workspaceStatePath: string;
  backlogPath: string;
  dailyPath: string;
  draftPath: string;
  date: string;
  shortHead: string;
};

type FileUpdate = {
  path: string;
  content: string;
};

type VerifiedApplyState = {
  workstreamPath: string;
  workspaceDir: string;
};

const runGit = (cwd: string, args: readonly string[]): string =>
  execFileSync('git', [...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const optionalGit = (cwd: string, args: readonly string[]): string | null => {
  try {
    return runGit(cwd, args);
  } catch {
    return null;
  }
};

const splitLines = (value: string | null): string[] =>
  value === null || value.length === 0 ? [] : value.split('\n').filter((line) => line.length > 0);

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

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const compactItems = (items: readonly string[]): string[] =>
  items.map((item) => item.trim()).filter((item) => item.length > 0);

const normalizeDraft = (draft: PcDoneDraft): PcDoneDraft => ({
  ...draft,
  completed: compactItems(draft.completed),
  verification: compactItems(draft.verification),
  remaining: compactItems(draft.remaining),
  nextAction: draft.nextAction.trim(),
  nextActionEvidence: draft.nextActionEvidence.trim(),
  blockers: compactItems(draft.blockers),
  durableContextDelta: draft.durableContextDelta?.trim() || null,
});

const assertFilledDraft = (draft: PcDoneDraft): void => {
  if (draft.nextAction.trim().length === 0 || draft.nextActionEvidence.trim().length === 0) {
    throw new Error(FILLED_DRAFT_ERROR);
  }
};

const timestampForFile = (date: Date): string => date.toISOString().replace(/[:.]/g, '').replace('Z', 'Z');

const dateFromIso = (value: string): string => {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
};

const formatBullets = (items: readonly string[], fallback: string): string =>
  items.length > 0 ? items.map((item) => `  - ${item}`).join('\n') : `  - ${fallback}`;

const replaceMarkdownSection = (content: string, heading: string, body: string): string => {
  const escapedHeading = escapeRegex(heading);
  const match = new RegExp(`^##\\s+${escapedHeading}\\s*$`, 'mu').exec(content);
  const normalizedBody = body.trim();
  if (!match) {
    return ensureTrailingNewline(`${content.trimEnd()}\n\n## ${heading}\n\n${normalizedBody}`);
  }

  const bodyStart = match.index + match[0].length;
  const rest = content.slice(bodyStart);
  const nextHeading = /^##\s+/mu.exec(rest);
  const bodyEnd = nextHeading ? bodyStart + nextHeading.index : content.length;
  return ensureTrailingNewline(
    `${content.slice(0, bodyStart).trimEnd()}\n\n${normalizedBody}\n\n${content.slice(bodyEnd).trimStart()}`,
  );
};

const upsertMarkedBlockInSection = (params: {
  content: string;
  heading: string;
  marker: string;
  block: string;
}): string => {
  const startMarker = `<!-- ${params.marker}:start -->`;
  const endMarker = `<!-- ${params.marker}:end -->`;
  const markedBlock = `${startMarker}\n${params.block.trim()}\n${endMarker}`;
  const existing = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`, 'm');
  if (existing.test(params.content)) {
    return ensureTrailingNewline(params.content.replace(existing, markedBlock));
  }

  const section = extractSection(params.content, [params.heading]);
  const nextSection = `${section.trimEnd()}\n\n${markedBlock}`.trim();
  return replaceMarkdownSection(params.content, params.heading, nextSection);
};

const upsertMarkedBlockAtEnd = (params: { content: string; marker: string; block: string }): string => {
  const startMarker = `<!-- ${params.marker}:start -->`;
  const endMarker = `<!-- ${params.marker}:end -->`;
  const markedBlock = `${startMarker}\n${params.block.trim()}\n${endMarker}`;
  const existing = new RegExp(`${escapeRegex(startMarker)}[\\s\\S]*?${escapeRegex(endMarker)}`, 'm');
  if (existing.test(params.content)) {
    return ensureTrailingNewline(params.content.replace(existing, markedBlock));
  }
  return ensureTrailingNewline(`${params.content.trimEnd()}\n\n${markedBlock}`);
};

const updateLastUpdated = (content: string, date: string): string => {
  if (/^- 마지막 갱신일: .+$/mu.test(content)) {
    return content.replace(/^- 마지막 갱신일: .+$/mu, `- 마지막 갱신일: ${date}`);
  }
  return content;
};

const upsertLastConfirmedCommit = (params: {
  content: string;
  entryId: string;
  productHead: string;
}): string => {
  const section = extractSection(params.content, ['마지막 확인 Commit', 'Last Confirmed Commit']);
  const escapedEntryId = escapeRegex(params.entryId);
  const linePattern = new RegExp(`^-\\s+\`?${escapedEntryId}\`?:\\s*(?:[a-f0-9]{40}|none|null|-).*$`, 'imu');
  const nextLine = `- \`${params.entryId}\`: ${params.productHead}`;
  const nextSection = linePattern.test(section)
    ? section.replace(linePattern, nextLine).trim()
    : `${section.trimEnd()}\n${nextLine}`.trim();
  return replaceMarkdownSection(params.content, '마지막 확인 Commit', nextSection);
};

const renderNextActionSection = (draft: PcDoneDraft): string =>
  [
    draft.nextAction,
    '',
    `- 근거: ${draft.nextActionEvidence}`,
    `- 확인 필요: ${draft.blockers.length > 0 ? draft.blockers.join('; ') : '없음'}`,
  ].join('\n');

const commitRangeText = (draft: PcDoneDraft): string =>
  draft.lastConfirmedCommitHash && draft.lastConfirmedCommitHash !== draft.productHead
    ? `${draft.lastConfirmedCommitHash}..${draft.productHead}`
    : draft.productHead;

const renderWorkstreamHandoffBlock = (ctx: ApplyContext): string =>
  [
    `### ${ctx.date} ${ctx.shortHead}`,
    '',
    '- 완료:',
    formatBullets(ctx.draft.completed, '없음'),
    '- 엔트리별 근거:',
    `  - \`${ctx.draft.currentEntryId}\`: commit \`${ctx.shortHead}\` (${commitRangeText(ctx.draft)})`,
    '- 기록 기준:',
    '  - 사용자 제공: no',
    `  - Commit range: ${commitRangeText(ctx.draft)}`,
    '- 검증:',
    formatBullets(ctx.draft.verification, '없음'),
    '- 남은 일:',
    formatBullets(ctx.draft.remaining, '없음'),
    `- 다음 첫 행동: ${ctx.draft.nextAction}`,
    `- 다음 행동 근거: ${ctx.draft.nextActionEvidence}`,
    '- 막힌 점:',
    formatBullets(ctx.draft.blockers, '없음'),
  ].join('\n');

const updateWorkstream = (ctx: ApplyContext): FileUpdate => {
  const fallback = [
    `# ${ctx.draft.workstreamId}`,
    '',
    '## 식별',
    '',
    `- ID: ${ctx.draft.workstreamId}`,
    '- 상태: Active',
    `- 마지막 갱신일: ${ctx.date}`,
    '',
  ].join('\n');
  const current = readText(ctx.workstreamPath, fallback);
  const withUpdatedDate = updateLastUpdated(current, ctx.date);
  const withNextAction = replaceMarkdownSection(withUpdatedDate, '다음 첫 행동', renderNextActionSection(ctx.draft));
  const withCommit = upsertLastConfirmedCommit({
    content: withNextAction,
    entryId: ctx.draft.currentEntryId,
    productHead: ctx.draft.productHead,
  });
  const content = upsertMarkedBlockInSection({
    content: withCommit,
    heading: 'Handoff',
    marker: `ai-ops:pc-done:${ctx.draft.productHead}`,
    block: renderWorkstreamHandoffBlock(ctx),
  });
  return { path: ctx.workstreamPath, content };
};

const renderWorkspaceHandoffSection = (ctx: ApplyContext): string =>
  [
    `- 날짜: ${ctx.date}`,
    `- Workstream: \`${ctx.draft.workstreamId}\``,
    `- 요약: \`${ctx.shortHead}\` 기준 handoff를 기록했다. 완료 ${ctx.draft.completed.length}개, 검증 ${ctx.draft.verification.length}개, 남은 일 ${ctx.draft.remaining.length}개.`,
    `- 다음 첫 행동: ${ctx.draft.nextAction}`,
    `- 다음 행동 근거: ${ctx.draft.nextActionEvidence}`,
  ].join('\n');

const updateDurableContext = (params: { content: string; ctx: ApplyContext }): string => {
  const delta = params.ctx.draft.durableContextDelta;
  if (!delta) {
    return params.content;
  }
  return upsertMarkedBlockInSection({
    content: params.content,
    heading: '장기 결정',
    marker: `ai-ops:pc-done:durable:${params.ctx.draft.productHead}`,
    block: `- ${params.ctx.date}: ${delta}`,
  });
};

const updateWorkspaceState = (ctx: ApplyContext): FileUpdate => {
  const fallback = [
    `# ${ctx.draft.workspaceId}`,
    '',
    '## 식별',
    '',
    `- 워크스페이스 ID: ${ctx.draft.workspaceId}`,
    `- 워크스페이스 루트: ${ctx.draft.workspaceDir}`,
    `- 마지막 갱신일: ${ctx.date}`,
    '',
  ].join('\n');
  const current = readText(ctx.workspaceStatePath, fallback);
  const withUpdatedDate = updateLastUpdated(current, ctx.date);
  const withHandoff = replaceMarkdownSection(withUpdatedDate, '마지막 Handoff', renderWorkspaceHandoffSection(ctx));
  const content = updateDurableContext({ content: withHandoff, ctx });
  return { path: ctx.workspaceStatePath, content };
};

const updateBacklogBlock = (params: { block: string[]; ctx: ApplyContext }): string[] => {
  const lines = [...params.block];
  const nextActionLine = `  - 다음 첫 행동: ${params.ctx.draft.nextAction}`;
  const summaryLine = `  - 요약: \`${params.ctx.shortHead}\` handoff 기록. 완료 ${params.ctx.draft.completed.length}개, 남은 일 ${params.ctx.draft.remaining.length}개.`;
  const replaceOrAppend = (pattern: RegExp, line: string): void => {
    const index = lines.findIndex((candidate) => pattern.test(candidate));
    if (index >= 0) {
      lines[index] = line;
      return;
    }
    lines.push(line);
  };
  replaceOrAppend(/^\s+-\s+다음 첫 행동:/u, nextActionLine);
  replaceOrAppend(/^\s+-\s+요약:/u, summaryLine);
  return lines;
};

const updateBacklog = (ctx: ApplyContext): FileUpdate => {
  const fallback = [
    '# Workstream Index',
    '',
    '## 진행중',
    '',
    `- [ ] \`${ctx.draft.workstreamId}\` ${ctx.draft.workstreamId}`,
    '  - 상태: Active',
    `  - 범위: ${ctx.draft.currentEntryId}`,
    `  - 파일: workstreams/${ctx.draft.workstreamId}.md`,
    '',
  ].join('\n');
  const current = readText(ctx.backlogPath, fallback);
  const lines = current.split('\n');
  const start = lines.findIndex((line) => line.includes(`\`${ctx.draft.workstreamId}\``));
  if (start < 0) {
    const addition = [
      `- [ ] \`${ctx.draft.workstreamId}\` ${ctx.draft.workstreamId}`,
      '  - 상태: Active',
      `  - 범위: ${ctx.draft.currentEntryId}`,
      `  - 파일: workstreams/${ctx.draft.workstreamId}.md`,
      `  - 다음 첫 행동: ${ctx.draft.nextAction}`,
      `  - 요약: \`${ctx.shortHead}\` handoff 기록.`,
    ].join('\n');
    return {
      path: ctx.backlogPath,
      content: replaceMarkdownSection(current, '진행중', `${extractSection(current, ['진행중']).trimEnd()}\n\n${addition}`),
    };
  }

  let end = start + 1;
  while (end < lines.length && !/^- \[[ xX]\]\s+`/.test(lines[end] ?? '') && !/^##\s+/.test(lines[end] ?? '')) {
    end += 1;
  }
  const nextLines = [
    ...lines.slice(0, start),
    ...updateBacklogBlock({ block: lines.slice(start, end), ctx }),
    ...lines.slice(end),
  ];
  return { path: ctx.backlogPath, content: nextLines.join('\n') };
};

const renderDailyBlock = (ctx: ApplyContext): string =>
  [
    `## ${ctx.draft.workspaceId}`,
    '',
    `- 활성 Workstream: ${ctx.draft.workstreamId}`,
    `- 엔트리: ${ctx.draft.currentEntryId}`,
    `- 확인 Commit: \`${ctx.shortHead}\``,
    '',
    '### 완료',
    '',
    formatBullets(ctx.draft.completed, '없음'),
    '',
    '### 근거',
    '',
    `- \`${ctx.draft.currentEntryId}\`: ${commitRangeText(ctx.draft)}`,
    ...ctx.draft.verification.map((item) => `- 테스트 / 확인: ${item}`),
    '',
    '### 남은 일',
    '',
    formatBullets(ctx.draft.remaining, '없음'),
    '',
    '### 다음 첫 행동',
    '',
    ctx.draft.nextAction,
    '',
    `- 근거: ${ctx.draft.nextActionEvidence}`,
    `- 확인 필요: ${ctx.draft.blockers.length > 0 ? ctx.draft.blockers.join('; ') : '없음'}`,
  ].join('\n');

const updateDaily = (ctx: ApplyContext): FileUpdate => {
  const fallback = `# ${ctx.date}\n`;
  const current = readText(ctx.dailyPath, fallback);
  const content = upsertMarkedBlockAtEnd({
    content: current,
    marker: `ai-ops:pc-done:${ctx.draft.workspaceId}:${ctx.draft.productHead}`,
    block: renderDailyBlock(ctx),
  });
  return { path: ctx.dailyPath, content };
};

const updateDraftMarker = (ctx: ApplyContext): FileUpdate => {
  const content = JSON.stringify(
    {
      ...ctx.draft,
      appliedAt: ctx.draft.appliedAt ?? new Date().toISOString(),
    },
    null,
    2,
  );
  return { path: ctx.draftPath, content };
};

const relativeToContext = (contextRoot: string, filePath: string): string => relative(contextRoot, filePath);

const assertInside = (params: { parent: string; child: string; label: string }): void => {
  if (!pathContains(params.parent, params.child)) {
    throw new Error(`${params.label} must be inside ${params.parent}`);
  }
};

const pathsEqual = (left: string, right: string): boolean => {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  try {
    return realpathSync(normalizedLeft) === realpathSync(normalizedRight);
  } catch {
    return false;
  }
};

const assertStatusMatchesDraft = (draft: PcDoneDraft, contextRoot: string): VerifiedApplyState => {
  const status = getPcHandoffStatus({
    cwd: draft.productGitRoot,
    contextRoot,
  });
  if (!status.ready) {
    throw new Error(`pc context is not ready: ${status.skipReason ?? 'unknown reason'}`);
  }
  if (status.workspaceId !== draft.workspaceId) {
    throw new Error(`workspace mismatch: draft=${draft.workspaceId}, current=${status.workspaceId ?? 'none'}`);
  }
  if (status.activeWorkstreamId !== draft.workstreamId) {
    throw new Error(
      `workstream mismatch: draft=${draft.workstreamId}, current=${status.activeWorkstreamId ?? 'none'}`,
    );
  }
  if (status.currentEntryId !== draft.currentEntryId) {
    throw new Error(`current entry mismatch: draft=${draft.currentEntryId}, current=${status.currentEntryId ?? 'none'}`);
  }
  if (!status.activeWorkstreamPath) {
    throw new Error('pc context status is incomplete: active workstream path not found');
  }
  const workspaceDir = dirname(dirname(status.activeWorkstreamPath));
  if (!pathsEqual(workspaceDir, draft.workspaceDir)) {
    throw new Error(`workspace directory mismatch: draft=${draft.workspaceDir}, current=${workspaceDir}`);
  }
  if (
    status.lastConfirmedCommitHash !== draft.lastConfirmedCommitHash &&
    status.lastConfirmedCommitHash !== draft.productHead
  ) {
    throw new Error(
      `last confirmed commit changed: draft=${draft.lastConfirmedCommitHash ?? 'none'}, current=${
        status.lastConfirmedCommitHash ?? 'none'
      }`,
    );
  }
  return {
    workstreamPath: status.activeWorkstreamPath,
    workspaceDir,
  };
};

const assertProductHeadMatchesDraft = (draft: PcDoneDraft): void => {
  const productGitRoot = resolveGitRoot(draft.productGitRoot);
  if (!productGitRoot || !pathsEqual(productGitRoot, draft.productGitRoot)) {
    throw new Error(`product git root mismatch: ${draft.productGitRoot}`);
  }
  const head = readGitHead(draft.productGitRoot);
  if (head !== draft.productHead) {
    throw new Error(`product HEAD changed: draft=${draft.productHead}, current=${head ?? 'none'}`);
  }
};

const assertCleanStagingArea = (contextRoot: string): void => {
  const staged = splitLines(optionalGit(contextRoot, ['diff', '--cached', '--name-only']));
  if (staged.length > 0) {
    throw new Error(`context repo has pre-staged changes: ${staged.join(', ')}`);
  }
};

const assertNoPreExistingManagedFileChanges = (params: {
  contextRoot: string;
  allowedPaths: readonly string[];
  allowedUntrackedPaths: readonly string[];
}): void => {
  const relativePaths = params.allowedPaths.map((filePath) => relativeToContext(params.contextRoot, filePath));
  const unstaged = splitLines(optionalGit(params.contextRoot, ['diff', '--name-only', '--', ...relativePaths]));
  const allowedUntracked = new Set(
    params.allowedUntrackedPaths.map((filePath) => relativeToContext(params.contextRoot, filePath)),
  );
  const untracked = splitLines(
    optionalGit(params.contextRoot, ['ls-files', '--others', '--exclude-standard', '--', ...relativePaths]),
  ).filter((filePath) => !allowedUntracked.has(filePath));
  const dirty = [...new Set([...unstaged, ...untracked])].sort((a, b) => a.localeCompare(b));
  if (dirty.length > 0) {
    throw new Error(`context repo has pre-existing changes in managed files: ${dirty.join(', ')}`);
  }
};

const commitContextChanges = (params: {
  contextRoot: string;
  allowedPaths: readonly string[];
  message: string;
}): { committed: boolean; commitHash: string | null; changedFiles: string[] } => {
  assertCleanStagingArea(params.contextRoot);

  const relativePaths = params.allowedPaths.map((filePath) => relativeToContext(params.contextRoot, filePath));
  execFileSync('git', ['add', ...relativePaths], { cwd: params.contextRoot, stdio: 'ignore' });
  const stagedFiles = splitLines(runGit(params.contextRoot, ['diff', '--cached', '--name-only']));
  const allowedSet = new Set(relativePaths);
  const unexpected = stagedFiles.filter((filePath) => !allowedSet.has(filePath));
  if (unexpected.length > 0) {
    throw new Error(`apply attempted to stage unexpected files: ${unexpected.join(', ')}`);
  }
  if (stagedFiles.length === 0) {
    return {
      committed: false,
      commitHash: null,
      changedFiles: [],
    };
  }

  execFileSync('git', ['commit', '-m', params.message], {
    cwd: params.contextRoot,
    stdio: 'ignore',
  });
  const commitHash = readGitHead(params.contextRoot);
  return {
    committed: true,
    commitHash,
    changedFiles: stagedFiles,
  };
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
  return normalizeDraft(PcDoneDraftSchema.parse(parsed));
};

export const applyPcDoneDraft = (params: {
  draftPath: string;
  contextRoot: string;
}): ApplyPcDoneDraftResult => {
  const contextRoot = normalizePath(params.contextRoot);
  const draftPath = normalizePath(params.draftPath);
  assertInside({ parent: contextRoot, child: draftPath, label: 'draft path' });

  const draft = readPcDoneDraft(draftPath);
  assertFilledDraft(draft);
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
  const dailyPath = join(contextRoot, 'daily', `${date}.md`);
  const ctx: ApplyContext = {
    draft,
    contextRoot,
    workspaceDir: verified.workspaceDir,
    workstreamPath: verified.workstreamPath,
    workspaceStatePath: join(verified.workspaceDir, 'workspace-state.md'),
    backlogPath: join(verified.workspaceDir, 'backlog.md'),
    dailyPath,
    draftPath,
    date,
    shortHead: draft.productHead.slice(0, 7),
  };
  const updates = [
    updateWorkstream(ctx),
    updateWorkspaceState(ctx),
    updateBacklog(ctx),
    updateDaily(ctx),
    updateDraftMarker(ctx),
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
  for (const update of updates) {
    writeIfChanged(update.path, update.content);
  }

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
