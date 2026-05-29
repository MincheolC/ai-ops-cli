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

export type CodexHookDefinition = {
  id: string;
  commandMarker: string;
  legacyCommandMarkers: readonly string[];
  defaultCommand: string;
  statusMessage: string;
};

type JsonRecord = Record<string, unknown>;

// ----- constants -----

export const CONTEXT_PROMOTION_HOOK_ID = 'context-promotion';
export const CONTEXT_PROMOTION_HOOK_COMMAND_MARKER = 'context-promotion hook post-tool-use';
export const CONTEXT_PROMOTION_LEGACY_HOOK_COMMAND_MARKER = 'context-promotion hook pre-tool-use';
export const CONTEXT_PROMOTION_DEFAULT_HOOK_COMMAND = `ai-ops ${CONTEXT_PROMOTION_HOOK_COMMAND_MARKER}`;

export const PC_HOOK_ID = 'pc';
export const PC_HOOK_COMMAND_MARKER = 'integration hook post-tool-use pc';
export const PC_DEFAULT_HOOK_COMMAND = `ai-ops ${PC_HOOK_COMMAND_MARKER}`;

const PRE_TOOL_USE_EVENT = 'PreToolUse';
const POST_TOOL_USE_EVENT = 'PostToolUse';
const BASH_MATCHER = '^Bash$';

export const CONTEXT_PROMOTION_CODEX_HOOK: CodexHookDefinition = {
  id: CONTEXT_PROMOTION_HOOK_ID,
  commandMarker: CONTEXT_PROMOTION_HOOK_COMMAND_MARKER,
  legacyCommandMarkers: [CONTEXT_PROMOTION_LEGACY_HOOK_COMMAND_MARKER],
  defaultCommand: CONTEXT_PROMOTION_DEFAULT_HOOK_COMMAND,
  statusMessage: 'Checking context promotion review',
} as const;

export const PC_CODEX_HOOK: CodexHookDefinition = {
  id: PC_HOOK_ID,
  commandMarker: PC_HOOK_COMMAND_MARKER,
  legacyCommandMarkers: [],
  defaultCommand: PC_DEFAULT_HOOK_COMMAND,
  statusMessage: 'Checking pc handoff',
} as const;

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

const handlerMatchesDefinition =
  (definition: CodexHookDefinition) =>
  (handler: unknown): boolean =>
    isJsonRecord(handler) &&
    typeof handler.command === 'string' &&
    [definition.commandMarker, ...definition.legacyCommandMarkers].some((marker) => handler.command.includes(marker));

const handlerMatchesCommand = (handler: unknown, command: string): boolean =>
  isJsonRecord(handler) && handler.command === command;

const groupHasDefinitionHook =
  (definition: CodexHookDefinition) =>
  (group: unknown): boolean =>
    isJsonRecord(group) && getArray(group, 'hooks').some(handlerMatchesDefinition(definition));

const groupHasCurrentDefinitionHook = (group: unknown, command: string): boolean =>
  isJsonRecord(group) && getArray(group, 'hooks').some((handler) => handlerMatchesCommand(handler, command));

const countDefinitionHandlers = (groups: readonly unknown[], definition: CodexHookDefinition): number =>
  groups.reduce((count, group) => {
    if (!isJsonRecord(group)) {
      return count;
    }
    return count + getArray(group, 'hooks').filter(handlerMatchesDefinition(definition)).length;
  }, 0);

const configHasDefinitionHook = (config: JsonRecord, definition: CodexHookDefinition): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  return getArray(hooks, POST_TOOL_USE_EVENT).some(groupHasDefinitionHook(definition));
};

const configHasOnlyCurrentDefinitionHook = (
  config: JsonRecord,
  definition: CodexHookDefinition,
  command: string,
): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  const hasLegacy = getArray(hooks, PRE_TOOL_USE_EVENT).some(groupHasDefinitionHook(definition));
  const postGroups = getArray(hooks, POST_TOOL_USE_EVENT);
  const hasCurrent = postGroups.some((group) => groupHasCurrentDefinitionHook(group, command));
  return hasCurrent && !hasLegacy && countDefinitionHandlers(postGroups, definition) === 1;
};

const removeDefinitionHooksFromEvent = (
  hooks: JsonRecord,
  eventName: string,
  definition: CodexHookDefinition,
): boolean => {
  const previousGroups = getArray(hooks, eventName);
  let removed = false;
  const nextGroups = previousGroups
    .map((group) => {
      if (!isJsonRecord(group)) {
        return group;
      }
      const previousHandlers = getArray(group, 'hooks');
      const nextHandlers = previousHandlers.filter((handler) => {
        const matches = handlerMatchesDefinition(definition)(handler);
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

export const buildCodexHookCommand = (params: {
  definition: CodexHookDefinition;
  overrideCommand?: string;
}): string => {
  const command = params.overrideCommand?.trim() ?? params.definition.defaultCommand;
  if (!command.includes(params.definition.commandMarker)) {
    throw new Error(`${params.definition.id} hook command must include: ${params.definition.commandMarker}`);
  }
  return command;
};

export const buildContextPromotionHookCommand = (overrideCommand?: string): string =>
  buildCodexHookCommand({
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
    overrideCommand,
  });

export const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const inspectCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
}): CodexHookStatusResult => ({
  hooksPath: params.hooksPath,
  installed: configHasDefinitionHook(readJsonRecord(params.hooksPath), params.definition),
});

export const inspectContextPromotionHook = (hooksPath: string): CodexHookStatusResult => ({
  hooksPath,
  installed: inspectCodexHook({ hooksPath, definition: CONTEXT_PROMOTION_CODEX_HOOK }).installed,
});

export const installCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
  command: string;
}): CodexHookInstallResult => {
  const config = readJsonRecord(params.hooksPath);
  if (configHasOnlyCurrentDefinitionHook(config, params.definition, params.command)) {
    return {
      hooksPath: params.hooksPath,
      installed: true,
      changed: false,
    };
  }

  const hooks = getOrCreateRecord(config, 'hooks');
  removeDefinitionHooksFromEvent(hooks, PRE_TOOL_USE_EVENT, params.definition);
  removeDefinitionHooksFromEvent(hooks, POST_TOOL_USE_EVENT, params.definition);
  const existingGroups = getArray(hooks, POST_TOOL_USE_EVENT);

  const nextGroup: JsonRecord = {
    matcher: BASH_MATCHER,
    hooks: [
      {
        type: 'command',
        command: params.command,
        timeout: 30,
        statusMessage: params.definition.statusMessage,
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

export const installContextPromotionHook = (params: { hooksPath: string; command: string }): CodexHookInstallResult =>
  installCodexHook({
    hooksPath: params.hooksPath,
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
    command: params.command,
  });

export const uninstallCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
}): CodexHookUninstallResult => {
  const config = readJsonRecord(params.hooksPath);
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return { hooksPath: params.hooksPath, removed: false, changed: false };
  }

  const removedLegacy = removeDefinitionHooksFromEvent(hooks, PRE_TOOL_USE_EVENT, params.definition);
  const removedCurrent = removeDefinitionHooksFromEvent(hooks, POST_TOOL_USE_EVENT, params.definition);
  const removed = removedLegacy || removedCurrent;

  if (!removed) {
    return { hooksPath: params.hooksPath, removed: false, changed: false };
  }
  writeJsonRecord(params.hooksPath, config);

  return { hooksPath: params.hooksPath, removed: true, changed: true };
};

export const uninstallContextPromotionHook = (hooksPath: string): CodexHookUninstallResult =>
  uninstallCodexHook({
    hooksPath,
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
  });
