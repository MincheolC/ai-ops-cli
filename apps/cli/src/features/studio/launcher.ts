import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const STUDIO_PLATFORM_PACKAGE = {
  platform: 'darwin',
  arch: 'arm64',
  packageName: 'ai-ops-studio-darwin-arm64',
  binaryRelativePath: ['bin', 'ai-ops-studio'],
} as const;

type SpawnResult = {
  readonly error?: Error;
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
};

type SpawnStudioBinary = (binaryPath: string, env: NodeJS.ProcessEnv) => SpawnResult;

type StudioLauncherDeps = {
  readonly platform: NodeJS.Platform;
  readonly arch: NodeJS.Architecture;
  readonly cwd: string;
  readonly cliBinPath: string | null;
  readonly env: NodeJS.ProcessEnv;
  readonly resolvePackageJsonPath: (packageName: string) => string;
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly spawnStudioBinary: SpawnStudioBinary;
};

export type StudioLaunchOptions = {
  readonly project: string;
  readonly deps?: Partial<StudioLauncherDeps>;
};

export type StudioLaunchResult =
  | { readonly ok: true; readonly exitCode: number }
  | { readonly ok: false; readonly message: string; readonly exitCode: number };

const requireFromHere = createRequire(import.meta.url);

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const resolvePackageJsonPath = (packageName: string): string => requireFromHere.resolve(`${packageName}/package.json`);

const spawnStudioBinary: SpawnStudioBinary = (binaryPath, env) => {
  const result = spawnSync(binaryPath, [], {
    env,
    stdio: 'inherit',
  });

  return {
    error: result.error,
    status: result.status,
    signal: result.signal,
  };
};

const getDefaultDeps = (): StudioLauncherDeps => ({
  platform: process.platform,
  arch: process.arch,
  cwd: process.cwd(),
  cliBinPath: process.argv[1] ?? null,
  env: process.env,
  resolvePackageJsonPath,
  exists: existsSync,
  isDirectory,
  spawnStudioBinary,
});

const mergeDeps = (overrides: Partial<StudioLauncherDeps> | undefined): StudioLauncherDeps => ({
  ...getDefaultDeps(),
  ...overrides,
});

const resolveProjectPath = (project: string, deps: StudioLauncherDeps): string => resolve(deps.cwd, project);

const createUnsupportedPlatformMessage = (deps: StudioLauncherDeps): string =>
  [
    `ai-ops Studio launcher is not available for ${deps.platform}/${deps.arch}.`,
    `Supported platform for this release: ${STUDIO_PLATFORM_PACKAGE.platform}/${STUDIO_PLATFORM_PACKAGE.arch}.`,
  ].join('\n');

const resolveStudioBinaryPath = (deps: StudioLauncherDeps): string => {
  const packageJsonPath = deps.resolvePackageJsonPath(STUDIO_PLATFORM_PACKAGE.packageName);
  return join(dirname(packageJsonPath), ...STUDIO_PLATFORM_PACKAGE.binaryRelativePath);
};

const createMissingPackageMessage = (error: unknown): string => {
  const detail = error instanceof Error ? error.message : 'unknown error';
  return [
    `ai-ops Studio platform package is missing: ${STUDIO_PLATFORM_PACKAGE.packageName}.`,
    'Reinstall ai-ops-cli on macOS arm64 so npm can install optional platform dependencies.',
    `Detail: ${detail}`,
  ].join('\n');
};

const resolveCliBinPath = (deps: StudioLauncherDeps): string | null =>
  deps.cliBinPath === null ? null : resolve(deps.cwd, deps.cliBinPath);

export const launchStudio = ({ project, deps: depsOverride }: StudioLaunchOptions): StudioLaunchResult => {
  const deps = mergeDeps(depsOverride);
  const projectPath = resolveProjectPath(project, deps);

  if (!deps.isDirectory(projectPath)) {
    return {
      ok: false,
      message: `Project path is not a directory: ${projectPath}`,
      exitCode: 1,
    };
  }

  if (deps.platform !== STUDIO_PLATFORM_PACKAGE.platform || deps.arch !== STUDIO_PLATFORM_PACKAGE.arch) {
    return {
      ok: false,
      message: createUnsupportedPlatformMessage(deps),
      exitCode: 1,
    };
  }

  let studioBinaryPath: string;
  try {
    studioBinaryPath = resolveStudioBinaryPath(deps);
  } catch (error) {
    return {
      ok: false,
      message: createMissingPackageMessage(error),
      exitCode: 1,
    };
  }

  if (!deps.exists(studioBinaryPath)) {
    return {
      ok: false,
      message: `ai-ops Studio binary is missing: ${studioBinaryPath}`,
      exitCode: 1,
    };
  }

  const cliBinPath = resolveCliBinPath(deps);
  const launchEnv: NodeJS.ProcessEnv = {
    ...deps.env,
    AI_OPS_STUDIO_PROJECT_ROOT: projectPath,
  };

  if (cliBinPath !== null) {
    launchEnv.AI_OPS_CLI_BIN = cliBinPath;
  }

  const result = deps.spawnStudioBinary(studioBinaryPath, launchEnv);

  if (result.error !== undefined) {
    return {
      ok: false,
      message: `Failed to launch ai-ops Studio: ${result.error.message}`,
      exitCode: 1,
    };
  }

  if (result.signal !== null) {
    return {
      ok: false,
      message: `ai-ops Studio exited from signal: ${result.signal}`,
      exitCode: 1,
    };
  }

  return {
    ok: true,
    exitCode: result.status ?? 0,
  };
};
