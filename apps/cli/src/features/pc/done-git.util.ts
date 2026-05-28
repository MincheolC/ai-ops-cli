import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
import { readGitHead } from './status.js';

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

const relativeToContext = (contextRoot: string, filePath: string): string => relative(contextRoot, filePath);

export const assertCleanStagingArea = (contextRoot: string): void => {
  const staged = splitLines(optionalGit(contextRoot, ['diff', '--cached', '--name-only']));
  if (staged.length > 0) {
    throw new Error(`context repo has pre-staged changes: ${staged.join(', ')}`);
  }
};

export const assertNoPreExistingManagedFileChanges = (params: {
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

export const commitContextChanges = (params: {
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
