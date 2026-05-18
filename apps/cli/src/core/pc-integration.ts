import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { parseSuccessfulGitCommitPostToolUseHook } from './tool-use-hook.js';

// ----- types -----

export type PcWorkspaceEntry = {
  id: string;
  path: string | null;
  gitRoot: string | null;
};

export type PcHandoffStatus = {
  cwd: string;
  contextRoot: string;
  workspaceId: string | null;
  workspaceRoot: string | null;
  activeWorkstreamId: string | null;
  activeWorkstreamPath: string | null;
  currentEntryId: string | null;
  lastConfirmedCommitHash: string | null;
  ready: boolean;
  skipReason: string | null;
};

export type PcPostToolUseHookOutput = {
  decision: 'block';
  reason: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext: string;
  };
};

type PcWorkspaceCandidate = {
  id: string;
  statePath: string;
  workspaceDir: string;
  workspaceRoot: string;
  activeWorkstreamId: string | null;
};

// ----- path and markdown helpers -----

const normalizePath = (path: string): string => resolve(path.replace(/^~(?=$|\/)/, process.env.HOME ?? '~'));

const pathContains = (parentPath: string, childPath: string): boolean => {
  const parent = normalizePath(parentPath);
  const child = normalizePath(childPath);
  return child === parent || child.startsWith(`${parent}${sep}`);
};

const normalizeFieldValue = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length === 0 || ['none', 'null', '-', '<empty>'].includes(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed.replace(/^`|`$/g, '');
};

const extractSection = (content: string, headings: readonly string[]): string => {
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`^##\\s+(?:${headingPattern})\\s*$`, 'mu').exec(content);
  if (!match) {
    return '';
  }
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = /^##\s+/mu.exec(rest);
  return nextHeading ? rest.slice(0, nextHeading.index) : rest;
};

const parseListField = (content: string, labels: readonly string[]): string | null => {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^-\\s+${escapedLabel}:\\s*(.+)$`, 'mu').exec(content);
    const value = normalizeFieldValue(match?.[1] ?? null);
    if (value) {
      return value;
    }
  }
  return null;
};

const readTextFileOrNull = (filePath: string): string | null => {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
};

// ----- git helpers -----

const runGit = (cwd: string, args: readonly string[]): string =>
  execFileSync('git', [...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

const resolveGitRoot = (cwd: string): string | null => {
  try {
    return runGit(cwd, ['rev-parse', '--show-toplevel']);
  } catch {
    return null;
  }
};

const readGitHead = (cwd: string): string | null => {
  try {
    return runGit(cwd, ['rev-parse', '--verify', 'HEAD']);
  } catch {
    return null;
  }
};

// ----- pc context preflight -----

const listWorkspaceStatePaths = (contextRoot: string): string[] => {
  const workspacesDir = join(contextRoot, 'workspaces');
  if (!existsSync(workspacesDir)) {
    return [];
  }

  return readdirSync(workspacesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(workspacesDir, entry.name, 'workspace-state.md'))
    .filter((statePath) => existsSync(statePath))
    .sort((a, b) => a.localeCompare(b));
};

const parseWorkspaceCandidate = (statePath: string): PcWorkspaceCandidate | null => {
  const content = readTextFileOrNull(statePath);
  if (!content) {
    return null;
  }
  const workspaceRoot = parseListField(content, ['워크스페이스 루트', 'Workspace Root']);
  if (!workspaceRoot) {
    return null;
  }

  const activeSection = extractSection(content, ['활성 Workstream', 'Active Workstream']);
  const activeWorkstreamId = parseListField(activeSection, ['ID', 'Workstream ID', 'Active Workstream']);
  const workspaceDir = resolve(statePath, '..');
  const id =
    parseListField(content, ['워크스페이스 ID', 'Workspace ID']) ?? workspaceDir.split(sep).at(-1) ?? 'unknown';

  return {
    id,
    statePath,
    workspaceDir,
    workspaceRoot,
    activeWorkstreamId,
  };
};

const findMatchingWorkspace = (params: { cwd: string; contextRoot: string }): PcWorkspaceCandidate | null => {
  const candidates = listWorkspaceStatePaths(params.contextRoot)
    .map(parseWorkspaceCandidate)
    .filter((candidate): candidate is PcWorkspaceCandidate => candidate !== null)
    .filter((candidate) => pathContains(candidate.workspaceRoot, params.cwd))
    .sort((a, b) => normalizePath(b.workspaceRoot).length - normalizePath(a.workspaceRoot).length);

  return candidates[0] ?? null;
};

const parseRepoEntry = (entryPath: string): PcWorkspaceEntry | null => {
  const content = readTextFileOrNull(entryPath);
  if (!content) {
    return null;
  }
  const id = parseListField(content, ['엔트리 ID', 'Entry ID']);
  if (!id) {
    return null;
  }

  return {
    id,
    path: parseListField(content, ['경로', 'Path']),
    gitRoot: parseListField(content, ['Git 루트', 'Git Root']),
  };
};

const findCurrentEntry = (params: { cwd: string; workspaceDir: string }): PcWorkspaceEntry | null => {
  const reposDir = join(params.workspaceDir, 'repos');
  if (!existsSync(reposDir)) {
    return null;
  }

  const entries = readdirSync(reposDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => parseRepoEntry(join(reposDir, entry.name)))
    .filter((entry): entry is PcWorkspaceEntry => entry !== null)
    .filter((entry) => {
      const paths = [entry.path, entry.gitRoot].filter((path): path is string => path !== null);
      return paths.some((path) => pathContains(path, params.cwd));
    })
    .sort((a, b) => {
      const aLength = Math.max(0, ...[a.path, a.gitRoot].map((path) => (path ? normalizePath(path).length : 0)));
      const bLength = Math.max(0, ...[b.path, b.gitRoot].map((path) => (path ? normalizePath(path).length : 0)));
      return bLength - aLength;
    });

  return entries[0] ?? null;
};

const parseWorkstreamScopeEntryIds = (content: string): string[] => {
  const scopeSection = extractSection(content, ['범위', 'Scope']);
  if (scopeSection.length === 0) {
    return [];
  }

  const lines = scopeSection.split('\n');
  const ids: string[] = [];
  let inEntryBlock = false;

  for (const line of lines) {
    if (/^-\s*(엔트리|Entries|Entry):/.test(line)) {
      inEntryBlock = true;
      const inlineValue = normalizeFieldValue(line.split(':').slice(1).join(':'));
      if (inlineValue && !inlineValue.includes('<')) {
        ids.push(...inlineValue.split(',').map((value) => value.trim().replace(/^`|`$/g, '')));
      }
      continue;
    }

    if (inEntryBlock && /^-\s+\S/.test(line)) {
      inEntryBlock = false;
    }

    if (!inEntryBlock) {
      continue;
    }

    const nestedMatch = /^\s+-\s+`?([a-z0-9]+(?:-[a-z0-9]+)*)`?/.exec(line);
    if (nestedMatch) {
      ids.push(nestedMatch[1]);
    }
  }

  return [...new Set(ids.filter((id) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)))];
};

const parseLastConfirmedCommitHash = (params: { content: string; entryId: string }): string | null => {
  const section = extractSection(params.content, ['마지막 확인 Commit', 'Last Confirmed Commit']);
  if (section.length === 0) {
    return null;
  }

  const escapedEntryId = params.entryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^-\\s+\`?${escapedEntryId}\`?:\\s*([a-f0-9]{40})\\b`, 'imu').exec(section);
  return match?.[1] ?? null;
};

export const getPcHandoffStatus = (params: { cwd: string; contextRoot: string }): PcHandoffStatus => {
  const cwd = normalizePath(params.cwd);
  const contextRoot = normalizePath(params.contextRoot);
  if (!existsSync(contextRoot)) {
    return {
      cwd,
      contextRoot,
      workspaceId: null,
      workspaceRoot: null,
      activeWorkstreamId: null,
      activeWorkstreamPath: null,
      currentEntryId: null,
      lastConfirmedCommitHash: null,
      ready: false,
      skipReason: 'pc context root not found',
    };
  }

  const workspace = findMatchingWorkspace({ cwd, contextRoot });
  if (!workspace) {
    return {
      cwd,
      contextRoot,
      workspaceId: null,
      workspaceRoot: null,
      activeWorkstreamId: null,
      activeWorkstreamPath: null,
      currentEntryId: null,
      lastConfirmedCommitHash: null,
      ready: false,
      skipReason: 'matching pc workspace not found',
    };
  }

  if (!workspace.activeWorkstreamId) {
    return {
      cwd,
      contextRoot,
      workspaceId: workspace.id,
      workspaceRoot: workspace.workspaceRoot,
      activeWorkstreamId: null,
      activeWorkstreamPath: null,
      currentEntryId: null,
      lastConfirmedCommitHash: null,
      ready: false,
      skipReason: 'active pc workstream not selected',
    };
  }

  const activeWorkstreamPath = join(workspace.workspaceDir, 'workstreams', `${workspace.activeWorkstreamId}.md`);
  const activeWorkstreamContent = readTextFileOrNull(activeWorkstreamPath);
  if (!activeWorkstreamContent) {
    return {
      cwd,
      contextRoot,
      workspaceId: workspace.id,
      workspaceRoot: workspace.workspaceRoot,
      activeWorkstreamId: workspace.activeWorkstreamId,
      activeWorkstreamPath,
      currentEntryId: null,
      lastConfirmedCommitHash: null,
      ready: false,
      skipReason: 'active pc workstream file not found',
    };
  }

  const currentEntry = findCurrentEntry({ cwd, workspaceDir: workspace.workspaceDir });
  if (!currentEntry) {
    return {
      cwd,
      contextRoot,
      workspaceId: workspace.id,
      workspaceRoot: workspace.workspaceRoot,
      activeWorkstreamId: workspace.activeWorkstreamId,
      activeWorkstreamPath,
      currentEntryId: null,
      lastConfirmedCommitHash: null,
      ready: false,
      skipReason: 'current repo is not registered in pc workspace',
    };
  }

  const lastConfirmedCommitHash = parseLastConfirmedCommitHash({
    content: activeWorkstreamContent,
    entryId: currentEntry.id,
  });

  const scopeEntryIds = parseWorkstreamScopeEntryIds(activeWorkstreamContent);
  if (scopeEntryIds.length > 0 && !scopeEntryIds.includes(currentEntry.id)) {
    return {
      cwd,
      contextRoot,
      workspaceId: workspace.id,
      workspaceRoot: workspace.workspaceRoot,
      activeWorkstreamId: workspace.activeWorkstreamId,
      activeWorkstreamPath,
      currentEntryId: currentEntry.id,
      lastConfirmedCommitHash,
      ready: false,
      skipReason: 'current repo is outside the active pc workstream scope',
    };
  }

  return {
    cwd,
    contextRoot,
    workspaceId: workspace.id,
    workspaceRoot: workspace.workspaceRoot,
    activeWorkstreamId: workspace.activeWorkstreamId,
    activeWorkstreamPath,
    currentEntryId: currentEntry.id,
    lastConfirmedCommitHash,
    ready: true,
    skipReason: null,
  };
};

// ----- hook output -----

const buildPcDonePrompt = (params: { status: PcHandoffStatus; head: string; gitRoot: string }): string =>
  [
    'A successful git commit just created a new HEAD commit.',
    '',
    'Run `$pc:done` now to record the handoff for the active personal project context.',
    '',
    'Important guardrails:',
    '- Do not create or initialize a new pc context from this hook.',
    '- If `$pc:done` cannot match the prepared workspace, active workstream, or current repo scope, skip and briefly say why.',
    '- If the active workstream already records this HEAD as the last confirmed commit, skip without writing another handoff.',
    '- Do not modify the product repo for this hook; `$pc:done` may only update `~/.personal-project-contexts/` and commit that context repo.',
    '- Use the just-created HEAD commit as the newest evidence for completed work and the next first action.',
    '',
    `Project git root: ${params.gitRoot}`,
    `HEAD: ${params.head}`,
    `pc context root: ${params.status.contextRoot}`,
    `pc workspace: ${params.status.workspaceId ?? 'unknown'} (${params.status.workspaceRoot ?? 'unknown'})`,
    `active workstream: ${params.status.activeWorkstreamId ?? 'unknown'}`,
    `current entry: ${params.status.currentEntryId ?? 'unknown'}`,
    `last confirmed commit: ${params.status.lastConfirmedCommitHash ?? 'none'}`,
  ].join('\n');

const buildPostToolUseOutput = (prompt: string): PcPostToolUseHookOutput => ({
  decision: 'block',
  reason: prompt,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: prompt,
  },
});

export const evaluatePcPostToolUseHook = (params: {
  hookInput: unknown;
  contextRoot: string;
}): PcPostToolUseHookOutput | null => {
  const gitCommitHook = parseSuccessfulGitCommitPostToolUseHook(params.hookInput);
  if (!gitCommitHook) {
    return null;
  }

  const gitRoot = resolveGitRoot(gitCommitHook.cwd);
  if (!gitRoot) {
    return null;
  }

  const head = readGitHead(gitRoot);
  if (!head) {
    return null;
  }

  const status = getPcHandoffStatus({
    cwd: gitCommitHook.cwd,
    contextRoot: params.contextRoot,
  });
  if (!status.ready) {
    return null;
  }
  if (status.lastConfirmedCommitHash === head) {
    return null;
  }

  return buildPostToolUseOutput(buildPcDonePrompt({ status, head, gitRoot }));
};
