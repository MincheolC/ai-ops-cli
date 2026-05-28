import { extractSection } from './markdown.js';
import type { ApplyContext, ContextFileContents, ContextFileFallbacks, FileUpdate } from './done-types.js';

const ensureTrailingNewline = (content: string): string => `${content.trimEnd()}\n`;

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const renderNextActionSection = (ctx: ApplyContext): string =>
  [
    ctx.draft.nextAction,
    '',
    `- 근거: ${ctx.draft.nextActionEvidence}`,
    `- 확인 필요: ${ctx.draft.blockers.length > 0 ? ctx.draft.blockers.join('; ') : '없음'}`,
  ].join('\n');

const commitRangeText = (ctx: ApplyContext): string =>
  ctx.draft.lastConfirmedCommitHash && ctx.draft.lastConfirmedCommitHash !== ctx.draft.productHead
    ? `${ctx.draft.lastConfirmedCommitHash}..${ctx.draft.productHead}`
    : ctx.draft.productHead;

const renderWorkstreamHandoffBlock = (ctx: ApplyContext): string =>
  [
    `### ${ctx.date} ${ctx.shortHead}`,
    '',
    '- 완료:',
    formatBullets(ctx.draft.completed, '없음'),
    '- 엔트리별 근거:',
    `  - \`${ctx.draft.currentEntryId}\`: commit \`${ctx.shortHead}\` (${commitRangeText(ctx)})`,
    '- 기록 기준:',
    '  - 사용자 제공: no',
    `  - Commit range: ${commitRangeText(ctx)}`,
    '- 검증:',
    formatBullets(ctx.draft.verification, '없음'),
    '- 남은 일:',
    formatBullets(ctx.draft.remaining, '없음'),
    `- 다음 첫 행동: ${ctx.draft.nextAction}`,
    `- 다음 행동 근거: ${ctx.draft.nextActionEvidence}`,
    '- 막힌 점:',
    formatBullets(ctx.draft.blockers, '없음'),
  ].join('\n');

const updateWorkstream = (ctx: ApplyContext, current: string): FileUpdate => {
  const withUpdatedDate = updateLastUpdated(current, ctx.date);
  const withNextAction = replaceMarkdownSection(withUpdatedDate, '다음 첫 행동', renderNextActionSection(ctx));
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

const updateWorkspaceState = (ctx: ApplyContext, current: string): FileUpdate => {
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

const updateBacklog = (ctx: ApplyContext, current: string): FileUpdate => {
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
    `- \`${ctx.draft.currentEntryId}\`: ${commitRangeText(ctx)}`,
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

const updateDaily = (ctx: ApplyContext, current: string): FileUpdate => {
  const content = upsertMarkedBlockAtEnd({
    content: current,
    marker: `ai-ops:pc-done:${ctx.draft.workspaceId}:${ctx.draft.productHead}`,
    block: renderDailyBlock(ctx),
  });
  return { path: ctx.dailyPath, content };
};

export const buildPcDoneContextFileFallbacks = (ctx: ApplyContext): ContextFileFallbacks => ({
  workstream: [
    `# ${ctx.draft.workstreamId}`,
    '',
    '## 식별',
    '',
    `- ID: ${ctx.draft.workstreamId}`,
    '- 상태: Active',
    `- 마지막 갱신일: ${ctx.date}`,
    '',
  ].join('\n'),
  workspaceState: [
    `# ${ctx.draft.workspaceId}`,
    '',
    '## 식별',
    '',
    `- 워크스페이스 ID: ${ctx.draft.workspaceId}`,
    `- 워크스페이스 루트: ${ctx.draft.workspaceDir}`,
    `- 마지막 갱신일: ${ctx.date}`,
    '',
  ].join('\n'),
  backlog: [
    '# Workstream Index',
    '',
    '## 진행중',
    '',
    `- [ ] \`${ctx.draft.workstreamId}\` ${ctx.draft.workstreamId}`,
    '  - 상태: Active',
    `  - 범위: ${ctx.draft.currentEntryId}`,
    `  - 파일: workstreams/${ctx.draft.workstreamId}.md`,
    '',
  ].join('\n'),
  daily: `# ${ctx.date}\n`,
});

export const buildPcDoneContextFileUpdates = (ctx: ApplyContext, contents: ContextFileContents): FileUpdate[] => [
  updateWorkstream(ctx, contents.workstream),
  updateWorkspaceState(ctx, contents.workspaceState),
  updateBacklog(ctx, contents.backlog),
  updateDaily(ctx, contents.daily),
];

export const buildPcDoneDraftMarkerUpdate = (ctx: ApplyContext, appliedAt: string): FileUpdate => ({
  path: ctx.draftPath,
  content: JSON.stringify(
    {
      ...ctx.draft,
      appliedAt: ctx.draft.appliedAt ?? appliedAt,
    },
    null,
    2,
  ),
});
