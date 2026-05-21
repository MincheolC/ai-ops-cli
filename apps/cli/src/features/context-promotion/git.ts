import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

export const readGitHead = (gitRoot: string): string => {
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
