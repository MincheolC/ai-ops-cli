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
export const CONTEXT_PROMOTION_HOOK_COMMAND_MARKER = 'context-promotion hook pre-tool-use';

const PRE_TOOL_USE_EVENT = 'PreToolUse';
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
  handler.command.includes(CONTEXT_PROMOTION_HOOK_COMMAND_MARKER);

const groupHasContextPromotionHook = (group: unknown): boolean =>
  isJsonRecord(group) && getArray(group, 'hooks').some(handlerMatchesContextPromotion);

const configHasContextPromotionHook = (config: JsonRecord): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  return getArray(hooks, PRE_TOOL_USE_EVENT).some(groupHasContextPromotionHook);
};

// ----- public API -----

export const resolveCodexHooksPath = (codexHomePath: string): string => join(codexHomePath, 'hooks.json');

export const buildContextPromotionHookCommand = (params: {
  nodePath: string;
  binPath: string;
}): string => `${quoteShellArg(params.nodePath)} ${quoteShellArg(params.binPath)} ${CONTEXT_PROMOTION_HOOK_COMMAND_MARKER}`;

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
  const hooks = getOrCreateRecord(config, 'hooks');
  const existingGroups = getArray(hooks, PRE_TOOL_USE_EVENT);
  if (existingGroups.some(groupHasContextPromotionHook)) {
    return {
      hooksPath: params.hooksPath,
      installed: true,
      changed: false,
    };
  }

  const nextGroup: JsonRecord = {
    matcher: BASH_MATCHER,
    hooks: [
      {
        type: 'command',
        command: params.command,
        timeout: 30,
        statusMessage: 'Checking context promotion receipt',
      },
    ],
  };
  hooks[PRE_TOOL_USE_EVENT] = [...existingGroups, nextGroup];
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

  const previousGroups = getArray(hooks, PRE_TOOL_USE_EVENT);
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
    return { hooksPath, removed: false, changed: false };
  }

  if (nextGroups.length > 0) {
    hooks[PRE_TOOL_USE_EVENT] = nextGroups;
  } else {
    delete hooks[PRE_TOOL_USE_EVENT];
  }
  writeJsonRecord(hooksPath, config);

  return { hooksPath, removed: true, changed: true };
};
