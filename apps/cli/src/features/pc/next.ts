import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { extractSection, normalizePath } from './markdown.js';
import { getPcHandoffStatus, resolveGitRoot } from './status.js';
import {
  assertCleanStagingArea,
  assertNoPreExistingManagedFileChanges,
  commitContextChanges,
} from './done-git.util.js';
import { assertInside, pathsEqual } from './done-preflight.logic.js';

export type RecordPcNextPrioritiesInput = {
  cwd: string;
  contextRoot: string;
  items: readonly string[];
  basis: string;
  recordedAt?: Date;
};

export type RecordPcNextPrioritiesResult = {
  contextRoot: string;
  changedFiles: string[];
  committed: boolean;
  commitHash: string | null;
};

type PcNextApplyContext = {
  workspaceId: string;
  workstreamId: string;
  currentEntryId: string;
  workstreamPath: string;
  backlogPath: string;
  date: string;
  items: string[];
  nextAction: string;
  basis: string;
};

type FileUpdate = {
  path: string;
  content: string;
};

const ensureTrailingNewline = (content: string): string => `${content.trimEnd()}\n`;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeItems = (items: readonly string[]): string[] =>
  items.map((item) => item.trim()).filter((item) => item.length > 0);

const formatNumberedList = (items: readonly string[]): string[] => items.map((item, index) => `${index + 1}. ${item}`);

const dateFromIso = (value: string): string => {
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  return match?.[0] ?? new Date().toISOString().slice(0, 10);
};

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

const updateLastUpdated = (content: string, date: string): string => {
  if (/^- 마지막 갱신일: .+$/mu.test(content)) {
    return content.replace(/^- 마지막 갱신일: .+$/mu, `- 마지막 갱신일: ${date}`);
  }
  return content;
};

const readText = (filePath: string): string => readFileSync(filePath, 'utf-8');

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

const renderNextActionSection = (ctx: PcNextApplyContext): string =>
  [ctx.nextAction, '', `- 근거: ${ctx.basis}`, '- 확인 필요: 없음'].join('\n');

const renderNextPrioritiesBlock = (ctx: PcNextApplyContext): string =>
  [
    '### 다음 우선순위',
    '',
    `- 기준: ${ctx.basis}`,
    `- 갱신일: ${ctx.date}`,
    `- 현재 엔트리: \`${ctx.currentEntryId}\``,
    '',
    ...formatNumberedList(ctx.items),
  ].join('\n');

const updateWorkstream = (ctx: PcNextApplyContext, current: string): FileUpdate => {
  const withUpdatedDate = updateLastUpdated(current, ctx.date);
  const withNextAction = replaceMarkdownSection(withUpdatedDate, '다음 첫 행동', renderNextActionSection(ctx));
  const content = upsertMarkedBlockInSection({
    content: withNextAction,
    heading: '남은 일',
    marker: 'ai-ops:pc-next',
    block: renderNextPrioritiesBlock(ctx),
  });
  return { path: ctx.workstreamPath, content };
};

const updateBacklogBlock = (params: { block: string[]; ctx: PcNextApplyContext }): string[] => {
  const lines = [...params.block];
  const replaceOrAppend = (pattern: RegExp, line: string): void => {
    const index = lines.findIndex((candidate) => pattern.test(candidate));
    if (index >= 0) {
      lines[index] = line;
      return;
    }
    lines.push(line);
  };
  replaceOrAppend(/^\s+-\s+다음 첫 행동:/u, `  - 다음 첫 행동: ${params.ctx.nextAction}`);
  replaceOrAppend(/^\s+-\s+다음 행동 근거:/u, `  - 다음 행동 근거: ${params.ctx.basis}`);
  replaceOrAppend(/^\s+-\s+요약:/u, `  - 요약: 다음 우선순위 ${params.ctx.items.length}개 저장.`);
  return lines;
};

const updateBacklog = (ctx: PcNextApplyContext, current: string): FileUpdate => {
  const lines = current.split('\n');
  const start = lines.findIndex((line) => line.includes(`\`${ctx.workstreamId}\``));
  if (start < 0) {
    const addition = [
      `- [ ] \`${ctx.workstreamId}\` ${ctx.workstreamId}`,
      '  - 상태: Active',
      `  - 범위: ${ctx.currentEntryId}`,
      `  - 파일: workstreams/${ctx.workstreamId}.md`,
      `  - 다음 첫 행동: ${ctx.nextAction}`,
      `  - 다음 행동 근거: ${ctx.basis}`,
      `  - 요약: 다음 우선순위 ${ctx.items.length}개 저장.`,
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
  return {
    path: ctx.backlogPath,
    content: [
      ...lines.slice(0, start),
      ...updateBacklogBlock({ block: lines.slice(start, end), ctx }),
      ...lines.slice(end),
    ].join('\n'),
  };
};

const writeUpdates = (updates: readonly FileUpdate[]): void => {
  for (const update of updates) {
    writeIfChanged(update.path, update.content);
  }
};

export const recordPcNextPriorities = (input: RecordPcNextPrioritiesInput): RecordPcNextPrioritiesResult => {
  const contextRoot = normalizePath(input.contextRoot);
  const cwd = normalizePath(input.cwd);
  const items = normalizeItems(input.items);
  const basis = input.basis.trim();
  if (items.length === 0) {
    throw new Error('at least one --item value is required');
  }
  if (basis.length === 0) {
    throw new Error('--basis <text> is required');
  }

  const status = getPcHandoffStatus({ cwd, contextRoot });
  if (!status.ready) {
    throw new Error(`pc context is not ready: ${status.skipReason ?? 'unknown reason'}`);
  }
  if (!status.workspaceId || !status.activeWorkstreamId || !status.currentEntryId || !status.activeWorkstreamPath) {
    throw new Error('pc context status is incomplete');
  }

  const contextGitRoot = resolveGitRoot(contextRoot);
  if (!contextGitRoot || !pathsEqual(contextGitRoot, contextRoot)) {
    throw new Error(`pc context root is not a git repo: ${contextRoot}`);
  }

  const workspaceDir = dirname(dirname(status.activeWorkstreamPath));
  assertInside({ parent: contextRoot, child: workspaceDir, label: 'workspace directory' });

  const recordedAt = input.recordedAt ?? new Date();
  const ctx: PcNextApplyContext = {
    workspaceId: status.workspaceId,
    workstreamId: status.activeWorkstreamId,
    currentEntryId: status.currentEntryId,
    workstreamPath: status.activeWorkstreamPath,
    backlogPath: join(workspaceDir, 'backlog.md'),
    date: dateFromIso(recordedAt.toISOString()),
    items,
    nextAction: items[0],
    basis,
  };

  const updates = [updateWorkstream(ctx, readText(ctx.workstreamPath)), updateBacklog(ctx, readText(ctx.backlogPath))];
  const allowedPaths = updates.map((update) => update.path);
  for (const filePath of allowedPaths) {
    assertInside({ parent: contextRoot, child: filePath, label: 'managed file' });
  }
  assertCleanStagingArea(contextRoot);
  assertNoPreExistingManagedFileChanges({
    contextRoot,
    allowedPaths,
    allowedUntrackedPaths: [],
  });
  writeUpdates(updates);

  const result = commitContextChanges({
    contextRoot,
    allowedPaths,
    message: `Record next priorities: ${ctx.workspaceId} ${ctx.workstreamId}`,
  });

  return {
    contextRoot,
    changedFiles: result.changedFiles,
    committed: result.committed,
    commitHash: result.commitHash,
  };
};
