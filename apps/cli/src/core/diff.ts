import type { Manifest } from './schemas/index.js';

export type DiffResult = {
  status: 'up-to-date' | 'changed';
  added: readonly string[];
  removed: readonly string[];
  sourceChanged: boolean;
  versionChanged: boolean;
};

export const computeDiff = (params: {
  previous: Manifest;
  currentRules: readonly string[];
  currentSourceHash: string;
  currentCliVersion?: string;
}): DiffResult => {
  const { previous, currentRules, currentSourceHash, currentCliVersion } = params;

  const previousSet = new Set(previous.installed_rules);
  const currentSet = new Set(currentRules);

  const added = currentRules.filter((id) => !previousSet.has(id));
  const removed = previous.installed_rules.filter((id) => !currentSet.has(id));
  const sourceChanged = previous.sourceHash !== currentSourceHash;
  // previous.cliVersion이 없는 레거시 manifest는 버전 변경으로 간주하지 않음
  const versionChanged =
    previous.cliVersion !== undefined &&
    currentCliVersion !== undefined &&
    previous.cliVersion !== currentCliVersion;

  const status =
    added.length > 0 || removed.length > 0 || sourceChanged || versionChanged ? 'changed' : 'up-to-date';

  return { status, added, removed, sourceChanged, versionChanged };
};
