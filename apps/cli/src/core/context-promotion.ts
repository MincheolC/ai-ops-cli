import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH } from './project-layer.js';

// ----- types -----

export const CONTEXT_PROMOTION_DECISION = {
  PROMOTED: 'promoted',
  NO_PROMOTION: 'no-promotion',
} as const;

export const CONTEXT_PROMOTION_SCOPE = {
  CORE: 'core',
  PROJECT_LOCAL: 'project-local',
  GLOBAL: 'global',
} as const;

const ContextPromotionDecisionSchema = z.union([
  z.literal(CONTEXT_PROMOTION_DECISION.PROMOTED),
  z.literal(CONTEXT_PROMOTION_DECISION.NO_PROMOTION),
]);

const ContextPromotionScopeSchema = z.union([
  z.literal(CONTEXT_PROMOTION_SCOPE.CORE),
  z.literal(CONTEXT_PROMOTION_SCOPE.PROJECT_LOCAL),
  z.literal(CONTEXT_PROMOTION_SCOPE.GLOBAL),
]);

const ContextPromotionReceiptSchema = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
    commitHash: z.string().regex(/^(NO_HEAD|[a-f0-9]{40})$/).optional(),
    decision: ContextPromotionDecisionSchema,
    scopes: z.array(ContextPromotionScopeSchema),
    targets: z.array(z.string().min(1)),
    summary: z.string().min(1),
    resolvedAt: z.string().min(1),
  })
  .strict();

const ContextPromotionReceiptIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('context-promotion-receipts'),
    projectKey: z.string().regex(/^[a-f0-9]{12}$/),
    projectRoot: z.string().min(1),
    receipts: z.array(ContextPromotionReceiptSchema),
  })
  .strict();

export type ContextPromotionDecision = z.infer<typeof ContextPromotionDecisionSchema>;
export type ContextPromotionScope = z.infer<typeof ContextPromotionScopeSchema>;
export type ContextPromotionReceipt = z.infer<typeof ContextPromotionReceiptSchema>;
export type ContextPromotionReceiptIndex = z.infer<typeof ContextPromotionReceiptIndexSchema>;

export type ContextPromotionProjectStatus = {
  cwd: string;
  gitRoot: string | null;
  hasContextLayer: boolean;
  projectKey: string | null;
  commitHash: string | null;
  fingerprint: string | null;
  receipt: ContextPromotionReceipt | null;
  receiptIndexPath: string | null;
};

export type ContextPromotionResolveInput = {
  decision: ContextPromotionDecision;
  summary: string;
  scopes: readonly ContextPromotionScope[];
  targets: readonly string[];
};

export type ContextPromotionPostToolUseHookOutput = {
  decision: 'block';
  reason: string;
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    additionalContext: string;
  };
};

// ----- constants -----

const RECEIPT_INDEX_FILENAME = 'receipts-index.json';
const DEFAULT_PRUNE_MAX = 50;

// ----- hashing -----

const hashHex = (parts: readonly string[], length: number): string =>
  createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, length);

export const buildContextPromotionProjectKey = (gitRoot: string): string => hashHex([resolve(gitRoot)], 12);

// ----- git helpers -----

const runGit = (cwd: string, args: readonly string[]): string =>
  execFileSync('git', [...args], {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

export const resolveContextPromotionGitRoot = (cwd: string): string | null => {
  try {
    return runGit(cwd, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    return null;
  }
};

const readGitHead = (gitRoot: string): string => {
  try {
    return runGit(gitRoot, ['rev-parse', '--verify', 'HEAD']).trim();
  } catch {
    return 'NO_HEAD';
  }
};

const readUntrackedFingerprintParts = (gitRoot: string): string[] => {
  const raw = runGit(gitRoot, ['ls-files', '--others', '--exclude-standard', '-z']);
  const paths = raw
    .split('\0')
    .filter((path) => path.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return paths.map((relativePath) => {
    const absolutePath = join(gitRoot, relativePath);
    try {
      const stat = statSync(absolutePath);
      if (!stat.isFile()) {
        return `${relativePath}:non-file`;
      }
      const content = readFileSync(absolutePath);
      return `${relativePath}:${createHash('sha256').update(content).digest('hex')}`;
    } catch {
      throw new Error(`Unable to read untracked path for context promotion fingerprint: ${relativePath}`);
    }
  });
};

const readTrackedWorkingTreeFingerprintParts = (gitRoot: string): string[] => {
  const rawDiff = runGit(gitRoot, ['diff', '--raw', '-z']);
  const rawNames = runGit(gitRoot, ['diff', '--name-only', '-z']);
  const paths = rawNames
    .split('\0')
    .filter((path) => path.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return [
    `raw:${rawDiff}`,
    ...paths.map((relativePath) => {
      const absolutePath = join(gitRoot, relativePath);
      if (!existsSync(absolutePath)) {
        return `${relativePath}:deleted`;
      }

      const stat = statSync(absolutePath);
      if (!stat.isFile()) {
        return `${relativePath}:non-file`;
      }

      const content = readFileSync(absolutePath);
      return `${relativePath}:${createHash('sha256').update(content).digest('hex')}`;
    }),
  ];
};

const readGitIndexFingerprintParts = (gitRoot: string): string[] => [
  `index:${runGit(gitRoot, ['ls-files', '-s', '-z'])}`,
  `staged-raw:${runGit(gitRoot, ['diff', '--cached', '--raw', '-z'])}`,
];

export const computeContextPromotionFingerprint = (gitRoot: string): string =>
  hashHex(
    [
      `head:${readGitHead(gitRoot)}`,
      ...readGitIndexFingerprintParts(gitRoot),
      ...readTrackedWorkingTreeFingerprintParts(gitRoot).map((part) => `tracked-working-tree:${part}`),
      ...readUntrackedFingerprintParts(gitRoot).map((part) => `untracked:${part}`),
    ],
    16,
  );

// ----- receipt storage -----

export const resolveContextPromotionReceiptIndexPath = (params: {
  userBasePath: string;
  projectKey: string;
}): string =>
  join(
    params.userBasePath,
    '.ai-ops',
    'context-promotion',
    'projects',
    params.projectKey,
    RECEIPT_INDEX_FILENAME,
  );

export const parseContextPromotionReceiptIndex = (json: string): ContextPromotionReceiptIndex =>
  ContextPromotionReceiptIndexSchema.parse(JSON.parse(json));

export const serializeContextPromotionReceiptIndex = (index: ContextPromotionReceiptIndex): string =>
  JSON.stringify(index, null, 2) + '\n';

export const readContextPromotionReceiptIndex = (indexPath: string): ContextPromotionReceiptIndex | null => {
  try {
    return parseContextPromotionReceiptIndex(readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
};

const writeContextPromotionReceiptIndex = (indexPath: string, index: ContextPromotionReceiptIndex): void => {
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, serializeContextPromotionReceiptIndex(index), 'utf-8');
};

const buildEmptyReceiptIndex = (params: {
  projectKey: string;
  projectRoot: string;
}): ContextPromotionReceiptIndex => ({
  schemaVersion: 1,
  kind: 'context-promotion-receipts',
  projectKey: params.projectKey,
  projectRoot: params.projectRoot,
  receipts: [],
});

const sortReceiptsByResolvedAtDesc = (receipts: readonly ContextPromotionReceipt[]): ContextPromotionReceipt[] =>
  [...receipts].sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));

export const findContextPromotionReceipt = (params: {
  index: ContextPromotionReceiptIndex | null;
  fingerprint: string;
  commitHash: string;
}): ContextPromotionReceipt | null => {
  const receipts = params.index?.receipts ?? [];
  return (
    receipts.find((receipt) => receipt.commitHash === params.commitHash) ??
    receipts.find((receipt) => receipt.fingerprint === params.fingerprint) ??
    null
  );
};

export const upsertContextPromotionReceipt = (params: {
  indexPath: string;
  projectKey: string;
  projectRoot: string;
  receipt: ContextPromotionReceipt;
  maxReceipts?: number;
}): ContextPromotionReceiptIndex => {
  const previous = readContextPromotionReceiptIndex(params.indexPath);
  const index =
    previous?.projectKey === params.projectKey
      ? previous
      : buildEmptyReceiptIndex({ projectKey: params.projectKey, projectRoot: params.projectRoot });
  const remaining = index.receipts.filter((receipt) => {
    if (receipt.fingerprint === params.receipt.fingerprint) {
      return false;
    }
    if (params.receipt.commitHash && receipt.commitHash === params.receipt.commitHash) {
      return false;
    }
    return true;
  });
  const maxReceipts = params.maxReceipts ?? DEFAULT_PRUNE_MAX;
  const receipts = sortReceiptsByResolvedAtDesc([params.receipt, ...remaining]).slice(0, maxReceipts);
  const nextIndex = {
    ...index,
    projectRoot: params.projectRoot,
    receipts,
  };
  writeContextPromotionReceiptIndex(params.indexPath, nextIndex);
  return nextIndex;
};

export const pruneContextPromotionReceipts = (params: {
  indexPath: string;
  maxReceipts: number;
}): ContextPromotionReceiptIndex | null => {
  const index = readContextPromotionReceiptIndex(params.indexPath);
  if (!index) {
    return null;
  }

  const nextIndex = {
    ...index,
    receipts: sortReceiptsByResolvedAtDesc(index.receipts).slice(0, params.maxReceipts),
  };
  writeContextPromotionReceiptIndex(params.indexPath, nextIndex);
  return nextIndex;
};

// ----- status and resolve -----

export const hasContextPromotionLayer = (gitRoot: string): boolean =>
  existsSync(join(gitRoot, PROJECT_LAYER_CONTEXT_INDEX_RELATIVE_PATH));

export const getContextPromotionStatus = (params: {
  cwd: string;
  userBasePath: string;
}): ContextPromotionProjectStatus => {
  const cwd = resolve(params.cwd);
  const gitRoot = resolveContextPromotionGitRoot(cwd);
  if (!gitRoot) {
    return {
      cwd,
      gitRoot: null,
      hasContextLayer: false,
      projectKey: null,
      commitHash: null,
      fingerprint: null,
      receipt: null,
      receiptIndexPath: null,
    };
  }

  const hasContextLayer = hasContextPromotionLayer(gitRoot);
  const projectKey = buildContextPromotionProjectKey(gitRoot);
  const commitHash = readGitHead(gitRoot);
  const receiptIndexPath = resolveContextPromotionReceiptIndexPath({
    userBasePath: params.userBasePath,
    projectKey,
  });
  if (!hasContextLayer) {
    return {
      cwd,
      gitRoot,
      hasContextLayer,
      projectKey,
      commitHash,
      fingerprint: null,
      receipt: null,
      receiptIndexPath,
    };
  }

  const fingerprint = computeContextPromotionFingerprint(gitRoot);
  const index = readContextPromotionReceiptIndex(receiptIndexPath);

  return {
    cwd,
    gitRoot,
    hasContextLayer,
    projectKey,
    commitHash,
    fingerprint,
    receipt: findContextPromotionReceipt({ index, fingerprint, commitHash }),
    receiptIndexPath,
  };
};

export const buildContextPromotionReceipt = (params: {
  fingerprint: string;
  commitHash: string;
  input: ContextPromotionResolveInput;
  resolvedAt?: string;
}): ContextPromotionReceipt => {
  const summary = params.input.summary.trim();
  if (summary.length === 0) {
    throw new Error('summary is required');
  }

  if (params.input.decision === CONTEXT_PROMOTION_DECISION.PROMOTED && params.input.scopes.length === 0) {
    throw new Error('at least one scope is required for promoted decisions');
  }

  return ContextPromotionReceiptSchema.parse({
    fingerprint: params.fingerprint,
    commitHash: params.commitHash,
    decision: params.input.decision,
    scopes: [...params.input.scopes],
    targets: [...params.input.targets],
    summary,
    resolvedAt: params.resolvedAt ?? new Date().toISOString(),
  });
};

export const resolveContextPromotion = (params: {
  cwd: string;
  userBasePath: string;
  input: ContextPromotionResolveInput;
}): ContextPromotionProjectStatus => {
  const status = getContextPromotionStatus({ cwd: params.cwd, userBasePath: params.userBasePath });
  if (!status.gitRoot || !status.projectKey || !status.commitHash || !status.fingerprint || !status.receiptIndexPath) {
    throw new Error('git repository is required for context promotion receipts');
  }
  if (!status.hasContextLayer) {
    throw new Error('ai-ops context layer is required for context promotion receipts');
  }

  const receipt = buildContextPromotionReceipt({
    fingerprint: status.fingerprint,
    commitHash: status.commitHash,
    input: params.input,
  });
  upsertContextPromotionReceipt({
    indexPath: status.receiptIndexPath,
    projectKey: status.projectKey,
    projectRoot: status.gitRoot,
    receipt,
  });

  return getContextPromotionStatus({ cwd: params.cwd, userBasePath: params.userBasePath });
};

// ----- hook guard -----

const HookToolInputSchema = z
  .object({
    command: z.string().optional(),
  })
  .passthrough();

const ToolUseHookInputSchema = z
  .object({
    hook_event_name: z.string(),
    cwd: z.string(),
    tool_name: z.string().optional(),
    tool_input: z.unknown().optional(),
    tool_response: z.unknown().optional(),
  })
  .passthrough();

const SHELL_CONTROL_TOKENS = new Set(['&&', '||', ';', '|', '(', ')']);
const SHELL_SCRIPT_FLAGS = new Set(['-c', '-lc']);
const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--config-env',
  '--exec-path',
]);

const basename = (token: string): string => token.replace(/\\/g, '/').split('/').at(-1) ?? token;

const isAssignmentToken = (token: string): boolean => /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);

const tokenizeShellLike = (command: string): string[] => {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  const pushCurrent = (): void => {
    if (current.length > 0) {
      tokens.push(current);
      current = '';
    }
  };

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    const nextChar = command[index + 1];

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushCurrent();
      continue;
    }

    if ((char === '&' && nextChar === '&') || (char === '|' && nextChar === '|')) {
      pushCurrent();
      tokens.push(`${char}${nextChar}`);
      index += 1;
      continue;
    }

    if (char === ';' || char === '|' || char === '(' || char === ')') {
      pushCurrent();
      tokens.push(char);
      continue;
    }

    current += char;
  }

  pushCurrent();
  return tokens;
};

const splitCommandSegments = (tokens: readonly string[]): string[][] => {
  const segments: string[][] = [];
  let current: string[] = [];

  for (const token of tokens) {
    if (SHELL_CONTROL_TOKENS.has(token)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(token);
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
};

const firstExecutableIndex = (segment: readonly string[]): number => {
  let index = 0;

  while (index < segment.length && isAssignmentToken(segment[index])) {
    index += 1;
  }

  if (segment[index] === 'env') {
    index += 1;
    while (index < segment.length && isAssignmentToken(segment[index])) {
      index += 1;
    }
  }

  if (segment[index] === 'command' || segment[index] === 'sudo') {
    index += 1;
  }

  return index;
};

const segmentInvokesGitCommit = (segment: readonly string[]): boolean => {
  const executableIndex = firstExecutableIndex(segment);
  if (executableIndex >= segment.length || basename(segment[executableIndex]) !== 'git') {
    return false;
  }

  for (let index = executableIndex + 1; index < segment.length; index += 1) {
    const token = segment[index];
    if (GIT_GLOBAL_OPTIONS_WITH_VALUE.has(token)) {
      index += 1;
      continue;
    }
    if (token.startsWith('-')) {
      continue;
    }
    return token === 'commit';
  }

  return false;
};

const segmentInvokesShellScriptWithGitCommit = (segment: readonly string[]): boolean => {
  const executableIndex = firstExecutableIndex(segment);
  const executable = segment[executableIndex];
  if (!executable || !['bash', 'sh', 'zsh'].includes(basename(executable))) {
    return false;
  }

  for (let index = executableIndex + 1; index < segment.length - 1; index += 1) {
    if (SHELL_SCRIPT_FLAGS.has(segment[index]) && isGitCommitCommand(segment[index + 1])) {
      return true;
    }
  }

  return false;
};

export const isGitCommitCommand = (command: string): boolean => {
  const segments = splitCommandSegments(tokenizeShellLike(command));
  return segments.some((segment) => segmentInvokesGitCommit(segment) || segmentInvokesShellScriptWithGitCommit(segment));
};

export const buildContextPromotionReviewPrompt = (status: ContextPromotionProjectStatus): string => {
  const projectRoot = status.gitRoot ?? status.cwd;
  const cdCommand = `cd ${JSON.stringify(projectRoot)}`;

  return [
    'Context Promotion Review should run for the completed work commit.',
    '',
    `Project root: ${projectRoot}`,
    'This project root is authoritative for this review.',
    '',
    'Use the `context-promotion-review` skill to review the just-created HEAD commit for reusable operating knowledge.',
    '',
    'Scope boundary:',
    `- Before inspecting files, anchor shell work in the project root above. If needed, run \`${cdCommand}\` first.`,
    '- Do not inspect other repositories, parent directories, or earlier conversation workspaces.',
    '- Do not search the web or external documentation for this review.',
    '- If `AGENTS.md`, `docs/agent/*`, `docs/docs-status.md`, or other context-layer files are absent, report them as absent; do not substitute files from another repo.',
    '- Use only the just-created `HEAD` commit, this conversation, and files under the project root.',
    '',
    'Review requirements:',
    '- Do not amend, rewrite, or mix changes into the work commit.',
    '- Inspect the completed commit before deciding: run `git show --stat HEAD`, `git show --name-only HEAD`, and `git show HEAD` when detail is needed.',
    '- Cross-check existing `AGENTS.md`, `docs/agent/*`, `docs/docs-status.md`, and `.ai-ops/context-layer.json` first.',
    '- Classify candidates as `core`, `project-local`, `global`, `already-covered`, or `no-promotion`.',
    '- Ask the user before editing any file.',
    '- If promotion is approved, edit only the approved context/global files, then stop for user inspection without committing.',
    '- After approved updates or a no-promotion/already-covered decision, run `ai-ops context-promotion resolve --decision <promoted|no-promotion> --summary "<summary>"` with any approved `--scope` and `--target` values.',
    '- Re-run `ai-ops context-promotion status` and confirm a receipt exists for the current HEAD.',
    '',
    `Project: ${projectRoot}`,
    `HEAD: ${status.commitHash ?? 'unknown'}`,
    `Fingerprint: ${status.fingerprint ?? 'unknown'}`,
  ].join('\n');
};

const buildContextPromotionStatusFailurePrompt = (cwd: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : 'unknown error';
  return [
    'Context Promotion Review could not inspect the completed work commit.',
    '',
    'The work command has already finished; do not amend or rewrite it for this hook.',
    'Do not search the web or inspect another repository to repair this hook review.',
    '',
    'Run `ai-ops context-promotion status` to inspect the failure, then decide whether a manual promotion review is needed.',
    '',
    `Project cwd: ${cwd}`,
    `Error: ${message}`,
  ].join('\n');
};

const buildPostToolUseOutput = (prompt: string): ContextPromotionPostToolUseHookOutput => ({
  decision: 'block',
  reason: prompt,
  hookSpecificOutput: {
    hookEventName: 'PostToolUse',
    additionalContext: prompt,
  },
});

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const numberField = (record: Record<string, unknown>, keys: readonly string[]): number | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return null;
};

const booleanField = (record: Record<string, unknown>, keys: readonly string[]): boolean | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return null;
};

const GIT_COMMIT_FAILURE_OUTPUT_PATTERNS = [
  /(^|\n)\s*fatal:/i,
  /(^|\n)\s*error:/i,
  /(^|\n)\s*nothing to commit\b/i,
  /(^|\n)\s*no changes added to commit\b/i,
  /(^|\n).*aborting commit\b/i,
  /(^|\n).*commit failed\b/i,
  /(^|\n).*failed to .*commit\b/i,
  /(^|\n).*command failed\b/i,
  /(^|\n).*non-zero exit\b/i,
  /(^|\n).*exit (code|status)\s+[1-9]\d*\b/i,
  /(^|\n).*exited with code\s+[1-9]\d*\b/i,
  /(^|\n).*hook.*(failed|declined|error|exit(?:ed)? with code|non-zero)/i,
] as const;

const GIT_COMMIT_SUCCESS_OUTPUT_PATTERN = /(^|\n)\[[^\]\n]+ [a-f0-9]{7,40}\]/i;

const stringIndicatesGitCommitSuccess = (output: string): boolean => GIT_COMMIT_SUCCESS_OUTPUT_PATTERN.test(output);

const stringIndicatesGitCommitFailureOrSuccess = (output: string): boolean | null =>
  stringIndicatesGitCommitSuccess(output)
    ? false
    : GIT_COMMIT_FAILURE_OUTPUT_PATTERNS.some((pattern) => pattern.test(output))
      ? true
      : null;

const recordStringFieldsIndicateGitCommitFailure = (record: Record<string, unknown>): boolean =>
  ['message', 'output', 'stdout', 'stderr', 'error', 'combinedOutput'].some((key) => {
    const value = record[key];
    return typeof value === 'string' && stringIndicatesGitCommitFailureOrSuccess(value) === true;
  });

const toolResponseIndicatesFailure = (toolResponse: unknown): boolean => {
  if (typeof toolResponse === 'string') {
    return stringIndicatesGitCommitFailureOrSuccess(toolResponse) === true;
  }

  if (!isJsonRecord(toolResponse)) {
    return false;
  }

  const success = booleanField(toolResponse, ['success', 'ok']);
  if (success === false) {
    return true;
  }

  const exitCode = numberField(toolResponse, ['exit_code', 'exitCode', 'status', 'code']);
  if (exitCode !== null && exitCode !== 0) {
    return true;
  }

  return recordStringFieldsIndicateGitCommitFailure(toolResponse);
};

export const evaluateContextPromotionPostToolUseHook = (params: {
  hookInput: unknown;
  userBasePath: string;
}): ContextPromotionPostToolUseHookOutput | null => {
  const hookInput = ToolUseHookInputSchema.safeParse(params.hookInput);
  if (!hookInput.success) {
    return null;
  }
  if (hookInput.data.hook_event_name !== 'PostToolUse' || hookInput.data.tool_name !== 'Bash') {
    return null;
  }

  const toolInput = HookToolInputSchema.safeParse(hookInput.data.tool_input);
  const command = toolInput.success ? (toolInput.data.command ?? '') : '';
  if (!isGitCommitCommand(command) || toolResponseIndicatesFailure(hookInput.data.tool_response)) {
    return null;
  }

  let status: ContextPromotionProjectStatus;
  try {
    status = getContextPromotionStatus({
      cwd: hookInput.data.cwd,
      userBasePath: params.userBasePath,
    });
  } catch (error) {
    return buildPostToolUseOutput(buildContextPromotionStatusFailurePrompt(hookInput.data.cwd, error));
  }

  if (!status.hasContextLayer || status.receipt) {
    return null;
  }

  return buildPostToolUseOutput(buildContextPromotionReviewPrompt(status));
};
