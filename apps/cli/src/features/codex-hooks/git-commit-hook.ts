import { z } from 'zod';

// ----- types -----

export type SuccessfulGitCommitPostToolUse = {
  cwd: string;
  command: string;
};

// ----- schemas -----

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

// ----- git commit command detection -----

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
  return segments.some(
    (segment) => segmentInvokesGitCommit(segment) || segmentInvokesShellScriptWithGitCommit(segment),
  );
};

// ----- tool response success guard -----

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

export const parseSuccessfulGitCommitPostToolUseHook = (hookInput: unknown): SuccessfulGitCommitPostToolUse | null => {
  const parsed = ToolUseHookInputSchema.safeParse(hookInput);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data.hook_event_name !== 'PostToolUse' || parsed.data.tool_name !== 'Bash') {
    return null;
  }

  const toolInput = HookToolInputSchema.safeParse(parsed.data.tool_input);
  const command = toolInput.success ? (toolInput.data.command ?? '') : '';
  if (!isGitCommitCommand(command) || toolResponseIndicatesFailure(parsed.data.tool_response)) {
    return null;
  }

  return {
    cwd: parsed.data.cwd,
    command,
  };
};
