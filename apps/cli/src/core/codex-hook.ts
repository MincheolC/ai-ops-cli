import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ----- types -----

export type CodexHookInstallResult = {
  hooksPath: string;
  installed: boolean;
  changed: boolean;
};

export type CodexHookStatusResult = {
  hooksPath: string;
  installed: boolean;
};

export type CodexHookUninstallResult = {
  hooksPath: string;
  removed: boolean;
  changed: boolean;
};

type JsonRecord = Record<string, unknown>;

// ----- constants -----

export const CONTEXT_PROMOTION_HOOK_ID = 'context-promotion';
export const CONTEXT_PROMOTION_HOOK_COMMAND_MARKER = 'context-promotion hook post-tool-use';
export const CONTEXT_PROMOTION_LEGACY_HOOK_COMMAND_MARKER = 'context-promotion hook pre-tool-use';
export const CONTEXT_PROMOTION_DEFAULT_HOOK_COMMAND = `ai-ops ${CONTEXT_PROMOTION_HOOK_COMMAND_MARKER}`;

const PRE_TOOL_USE_EVENT = 'PreToolUse';
const POST_TOOL_USE_EVENT = 'PostToolUse';
const BASH_MATCHER = '^Bash$';

// ----- JSON helpers -----

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonRecord = (filePath: string): JsonRecord => {
  if (!existsSync(filePath)) {
    return {};
  }

  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (!isJsonRecord(parsed)) {
    throw new Error('hooks.json must contain a JSON object');
  }
  return parsed;
};

const writeJsonRecord = (filePath: string, value: JsonRecord): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf-8');
};

const getOrCreateRecord = (record: JsonRecord, key: string): JsonRecord => {
  const existing = record[key];
  if (isJsonRecord(existing)) {
    return existing;
  }
  const next: JsonRecord = {};
  record[key] = next;
  return next;
};

const getArray = (record: JsonRecord, key: string): unknown[] => {
  const existing = record[key];
  return Array.isArray(existing) ? existing : [];
};

const handlerMatchesContextPromotion = (handler: unknown): boolean =>
  isJsonRecord(handler) &&
  typeof handler.command === 'string' &&
  (handler.command.includes(CONTEXT_PROMOTION_HOOK_COMMAND_MARKER) ||
    handler.command.includes(CONTEXT_PROMOTION_LEGACY_HOOK_COMMAND_MARKER));

const handlerMatchesCommand = (handler: unknown, command: string): boolean =>
  isJsonRecord(handler) && handler.command === command;

const groupHasContextPromotionHook = (group: unknown): boolean =>
  isJsonRecord(group) && getArray(group, 'hooks').some(handlerMatchesContextPromotion);

const groupHasCurrentContextPromotionHook = (group: unknown, command: string): boolean =>
  isJsonRecord(group) && getArray(group, 'hooks').some((handler) => handlerMatchesCommand(handler, command));

const countContextPromotionHandlers = (groups: readonly unknown[]): number =>
  groups.reduce((count, group) => {
    if (!isJsonRecord(group)) {
      return count;
    }
    return count + getArray(group, 'hooks').filter(handlerMatchesContextPromotion).length;
  }, 0);

const configHasContextPromotionHook = (config: JsonRecord): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  return getArray(hooks, POST_TOOL_USE_EVENT).some(groupHasContextPromotionHook);
};

const configHasOnlyCurrentContextPromotionHook = (config: JsonRecord, command: string): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  const hasLegacy = getArray(hooks, PRE_TOOL_USE_EVENT).some(groupHasContextPromotionHook);
  const postGroups = getArray(hooks, POST_TOOL_USE_EVENT);
  const hasCurrent = postGroups.some((group) => groupHasCurrentContextPromotionHook(group, command));
  return hasCurrent && !hasLegacy && countContextPromotionHandlers(postGroups) === 1;
};

const removeContextPromotionHooksFromEvent = (hooks: JsonRecord, eventName: string): boolean => {
  const previousGroups = getArray(hooks, eventName);
  let removed = false;
  const nextGroups = previousGroups
    .map((group) => {
      if (!isJsonRecord(group)) {
        return group;
      }
      const previousHandlers = getArray(group, 'hooks');
      const nextHandlers = previousHandlers.filter((handler) => {
        const matches = handlerMatchesContextPromotion(handler);
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
    return false;
  }

  if (nextGroups.length > 0) {
    hooks[eventName] = nextGroups;
  } else {
    delete hooks[eventName];
  }
  return true;
};

// ----- public API -----

export const resolveCodexHooksPath = (codexHomePath: string): string => join(codexHomePath, 'hooks.json');

export const buildContextPromotionHookCommand = (overrideCommand?: string): string => {
  const command = overrideCommand?.trim() ?? CONTEXT_PROMOTION_DEFAULT_HOOK_COMMAND;
  if (!command.includes(CONTEXT_PROMOTION_HOOK_COMMAND_MARKER)) {
    throw new Error(`context promotion hook command must include: ${CONTEXT_PROMOTION_HOOK_COMMAND_MARKER}`);
  }
  return command;
};

export const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const inspectContextPromotionHook = (hooksPath: string): CodexHookStatusResult => ({
  hooksPath,
  installed: configHasContextPromotionHook(readJsonRecord(hooksPath)),
});

export const installContextPromotionHook = (params: {
  hooksPath: string;
  command: string;
}): CodexHookInstallResult => {
  const config = readJsonRecord(params.hooksPath);
  if (configHasOnlyCurrentContextPromotionHook(config, params.command)) {
    return {
      hooksPath: params.hooksPath,
      installed: true,
      changed: false,
    };
  }

  const hooks = getOrCreateRecord(config, 'hooks');
  removeContextPromotionHooksFromEvent(hooks, PRE_TOOL_USE_EVENT);
  removeContextPromotionHooksFromEvent(hooks, POST_TOOL_USE_EVENT);
  const existingGroups = getArray(hooks, POST_TOOL_USE_EVENT);

  const nextGroup: JsonRecord = {
    matcher: BASH_MATCHER,
    hooks: [
      {
        type: 'command',
        command: params.command,
        timeout: 30,
        statusMessage: 'Checking context promotion review',
      },
    ],
  };
  hooks[POST_TOOL_USE_EVENT] = [...existingGroups, nextGroup];
  writeJsonRecord(params.hooksPath, config);

  return {
    hooksPath: params.hooksPath,
    installed: true,
    changed: true,
  };
};

export const uninstallContextPromotionHook = (hooksPath: string): CodexHookUninstallResult => {
  const config = readJsonRecord(hooksPath);
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return { hooksPath, removed: false, changed: false };
  }

  const removedLegacy = removeContextPromotionHooksFromEvent(hooks, PRE_TOOL_USE_EVENT);
  const removedCurrent = removeContextPromotionHooksFromEvent(hooks, POST_TOOL_USE_EVENT);
  const removed = removedLegacy || removedCurrent;

  if (!removed) {
    return { hooksPath, removed: false, changed: false };
  }
  writeJsonRecord(hooksPath, config);

  return { hooksPath, removed: true, changed: true };
};
