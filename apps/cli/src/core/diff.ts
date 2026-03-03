import type { Manifest } from './schemas/index.js';

export type DiffResult = {
  status: 'up-to-date' | 'changed';
  added: readonly string[];
  removed: readonly string[];
  sourceChanged: boolean;
};

export const computeDiff = (params: {
  previous: Manifest;
  currentRules: readonly string[];
  currentSourceHash: string;
}): DiffResult => {
  const { previous, currentRules, currentSourceHash } = params;

  const previousSet = new Set(previous.installed_rules);
  const currentSet = new Set(currentRules);

  const added = currentRules.filter((id) => !previousSet.has(id));
  const removed = previous.installed_rules.filter((id) => !currentSet.has(id));
  const sourceChanged = previous.sourceHash !== currentSourceHash;

  const status = added.length > 0 || removed.length > 0 || sourceChanged ? 'changed' : 'up-to-date';

  return { status, added, removed, sourceChanged };
};
