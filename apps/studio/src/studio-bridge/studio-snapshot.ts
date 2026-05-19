import { invoke } from '@tauri-apps/api/core';

export const STUDIO_SNAPSHOT_KIND = 'ai-ops-studio-snapshot' as const;
export const STUDIO_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type StudioSnapshotEnvelope = {
  readonly kind: typeof STUDIO_SNAPSHOT_KIND;
  readonly schemaVersion: typeof STUDIO_SNAPSHOT_SCHEMA_VERSION;
  readonly generatedAt: string | null;
  readonly cliVersion: string | null;
  readonly project: Record<string, unknown>;
  readonly runtime: Record<string, unknown>;
};

export class StudioSnapshotParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StudioSnapshotParseError';
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getOptionalString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' ? value : null;
};

const getJsonParseMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown parse error';

export const parseStudioSnapshotEnvelope = (rawSnapshot: string): StudioSnapshotEnvelope => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawSnapshot);
  } catch (error) {
    throw new StudioSnapshotParseError(`Invalid JSON: ${getJsonParseMessage(error)}`);
  }

  if (!isRecord(parsed)) {
    throw new StudioSnapshotParseError('Invalid snapshot envelope: expected object');
  }

  if (parsed.kind !== STUDIO_SNAPSHOT_KIND) {
    throw new StudioSnapshotParseError('Invalid snapshot envelope: unexpected kind');
  }

  if (parsed.schemaVersion !== STUDIO_SNAPSHOT_SCHEMA_VERSION) {
    throw new StudioSnapshotParseError('Invalid snapshot envelope: unsupported schemaVersion');
  }

  if (!isRecord(parsed.project)) {
    throw new StudioSnapshotParseError('Invalid snapshot envelope: project must be an object');
  }

  if (!isRecord(parsed.runtime)) {
    throw new StudioSnapshotParseError('Invalid snapshot envelope: runtime must be an object');
  }

  return {
    kind: STUDIO_SNAPSHOT_KIND,
    schemaVersion: STUDIO_SNAPSHOT_SCHEMA_VERSION,
    generatedAt: getOptionalString(parsed, 'generatedAt'),
    cliVersion: getOptionalString(parsed, 'cliVersion'),
    project: parsed.project,
    runtime: parsed.runtime,
  };
};

export const loadStudioSnapshot = async (): Promise<StudioSnapshotEnvelope> => {
  const rawSnapshot = await invoke<string>('load_studio_snapshot');
  return parseStudioSnapshotEnvelope(rawSnapshot);
};
