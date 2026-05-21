import { join } from 'node:path';
import { resolveBasePath } from '../../shared/command-paths.js';
import { buildStudioSnapshot } from './snapshot.js';

type StudioSnapshotCommandOptions = {
  json?: boolean;
};

const resolveOptionalUserBasePath = (): string | null => process.env.AI_OPS_HOME ?? process.env.HOME ?? null;

const resolveOptionalCodexHomePath = (): string | null => {
  if (process.env.CODEX_HOME && process.env.CODEX_HOME.length > 0) {
    return process.env.CODEX_HOME;
  }
  if (process.env.HOME && process.env.HOME.length > 0) {
    return join(process.env.HOME, '.codex');
  }
  return null;
};

const reportStudioSnapshotError = (error: unknown): void => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`[studio-snapshot] ${message}\n`);
  process.exitCode = 1;
};

export const studioSnapshotCommand = async (opts: StudioSnapshotCommandOptions): Promise<void> => {
  if (opts.json !== true) {
    process.stderr.write('[studio-snapshot] --json is required\n');
    process.exitCode = 1;
    return;
  }

  try {
    const snapshot = buildStudioSnapshot({
      basePath: resolveBasePath(),
      userBasePath: resolveOptionalUserBasePath(),
      codexHomePath: resolveOptionalCodexHomePath(),
    });
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  } catch (error) {
    reportStudioSnapshotError(error);
  }
};
