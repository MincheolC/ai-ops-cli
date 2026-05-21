import type { CodexSafePermissionFileStatus, ConfigEditResult, HookCleanupResult } from "./types.js";
import { LEGACY_PERMISSION_HOOK_MARKER, LEGACY_RULES_BLOCK_END, LEGACY_RULES_BLOCK_START, PERMISSION_REQUEST_EVENT } from "./types.js";
import { buildFileStatus, getArray, hasBlock, isJsonRecord, readJsonRecord, stripBlock, writeTextFile } from "./file-utils.js";

// ----- rules/default.rules legacy cleanup -----

export const cleanupLegacyRules = (content: string): ConfigEditResult => {
  const nextContent = stripBlock(content, LEGACY_RULES_BLOCK_START, LEGACY_RULES_BLOCK_END);
  return {
    content: nextContent,
    installed: true,
    changed: nextContent !== content,
    conflict: null,
  };
};

export const inspectLegacyRules = (content: string): ConfigEditResult => ({
  content,
  installed: !hasBlock(content, LEGACY_RULES_BLOCK_START, LEGACY_RULES_BLOCK_END),
  changed: false,
  conflict: null,
});

// ----- hooks.json legacy cleanup -----

const handlerMatchesLegacySafeLocalPermissionHook = (handler: unknown): boolean =>
  isJsonRecord(handler) &&
  typeof handler.command === 'string' &&
  handler.command.includes(LEGACY_PERMISSION_HOOK_MARKER);

const configHasLegacySafeLocalPermissionHook = (config: Record<string, unknown>): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  return getArray(hooks, PERMISSION_REQUEST_EVENT).some(
    (group) => isJsonRecord(group) && getArray(group, 'hooks').some(handlerMatchesLegacySafeLocalPermissionHook),
  );
};

const removeLegacySafeLocalPermissionHook = (config: Record<string, unknown>): HookCleanupResult => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return { config, removed: false };
  }

  const previousGroups = getArray(hooks, PERMISSION_REQUEST_EVENT);
  let removed = false;
  const nextGroups = previousGroups
    .map((group) => {
      if (!isJsonRecord(group)) {
        return group;
      }
      const previousHandlers = getArray(group, 'hooks');
      const nextHandlers = previousHandlers.filter((handler) => {
        const matches = handlerMatchesLegacySafeLocalPermissionHook(handler);
        if (matches) {
          removed = true;
        }
        return !matches;
      });
      if (nextHandlers.length === 0) {
        return null;
      }
      return {
        ...group,
        hooks: nextHandlers,
      };
    })
    .filter((group): group is Exclude<unknown, null> => group !== null);

  if (!removed) {
    return { config, removed: false };
  }

  if (nextGroups.length > 0) {
    hooks[PERMISSION_REQUEST_EVENT] = nextGroups;
  } else {
    delete hooks[PERMISSION_REQUEST_EVENT];
  }
  return { config, removed: true };
};

export const cleanupLegacyHookConfig = (hooksPath: string): CodexSafePermissionFileStatus => {
  const config = readJsonRecord(hooksPath);
  const cleanup = removeLegacySafeLocalPermissionHook(config);
  if (cleanup.removed) {
    writeTextFile(hooksPath, `${JSON.stringify(cleanup.config, null, 2)}\n`);
  }
  return buildFileStatus({
    path: hooksPath,
    installed: !configHasLegacySafeLocalPermissionHook(cleanup.config),
    changed: cleanup.removed,
    conflict: null,
  });
};

export const inspectLegacyHookConfig = (hooksPath: string): CodexSafePermissionFileStatus => {
  const config = readJsonRecord(hooksPath);
  return buildFileStatus({
    path: hooksPath,
    installed: !configHasLegacySafeLocalPermissionHook(config),
    changed: false,
    conflict: null,
  });
};
