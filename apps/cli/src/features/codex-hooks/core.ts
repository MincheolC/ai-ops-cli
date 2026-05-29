import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ----- types -----

export type CodexHookInstallResult = {
  hooksPath: string;
  installed: boolean;
  changed: boolean;
  command: string;
  commandWindows: string | null;
  workflows: CodexHookWorkflow[];
};

export type CodexHookStatusResult = {
  hooksPath: string;
  installed: boolean;
  trustReviewHint: string | null;
};

export type CodexHookUninstallResult = {
  hooksPath: string;
  removed: boolean;
  changed: boolean;
  workflows: CodexHookWorkflow[];
};

export type CodexHookWorkflow = 'context-promotion' | 'pc';

export type CodexHookCommandConfig = {
  command: string;
  commandWindows?: string;
};

export type CodexHookDefinition = {
  id: CodexHookWorkflow;
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

export const SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER = 'integration hook post-tool-use';
export const SHARED_POST_TOOL_USE_DEFAULT_HOOK_COMMAND = `ai-ops ${SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER}`;
export const CODEX_HOOK_TRUST_REVIEW_HINT =
  'configured; review and trust this non-managed hook with /hooks in Codex before it will run';

const PRE_TOOL_USE_EVENT = 'PreToolUse';
const POST_TOOL_USE_EVENT = 'PostToolUse';
const BASH_MATCHER = '^Bash$';
const SHARED_POST_TOOL_USE_STATUS_MESSAGE = 'Checking ai-ops post-commit workflows';

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

export const CODEX_HOOK_WORKFLOW_ORDER = [CONTEXT_PROMOTION_HOOK_ID, PC_HOOK_ID] as const;
const CODEX_HOOK_DEFINITIONS = [CONTEXT_PROMOTION_CODEX_HOOK, PC_CODEX_HOOK] as const;

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

const cloneJsonRecord = (record: JsonRecord): JsonRecord => JSON.parse(JSON.stringify(record)) as JsonRecord;

const recordsMatch = (left: JsonRecord, right: JsonRecord): boolean => JSON.stringify(left) === JSON.stringify(right);

const isCodexHookWorkflow = (value: string): value is CodexHookWorkflow =>
  CODEX_HOOK_WORKFLOW_ORDER.includes(value as CodexHookWorkflow);

const normalizeWorkflows = (workflows: readonly string[]): CodexHookWorkflow[] => {
  const requested = new Set(workflows.filter(isCodexHookWorkflow));
  return CODEX_HOOK_WORKFLOW_ORDER.filter((workflow) => requested.has(workflow));
};

const serializeWorkflows = (workflows: readonly CodexHookWorkflow[]): string => normalizeWorkflows(workflows).join(',');

const parseWorkflowList = (raw: string): CodexHookWorkflow[] =>
  normalizeWorkflows(
    raw
      .split(',')
      .map((workflow) => workflow.trim())
      .filter((workflow) => workflow.length > 0),
  );

const parseWorkflowsFromCommand = (command: string): CodexHookWorkflow[] => {
  const equalsMatch = /(?:^|\s)--workflows=([^\s]+)/.exec(command);
  if (equalsMatch) {
    return parseWorkflowList(equalsMatch[1]);
  }

  const valueMatch = /(?:^|\s)--workflows\s+([^\s]+)/.exec(command);
  if (valueMatch) {
    return parseWorkflowList(valueMatch[1]);
  }

  return normalizeWorkflows(
    CODEX_HOOK_DEFINITIONS.filter((definition) =>
      [definition.commandMarker, ...definition.legacyCommandMarkers].some((marker) => command.includes(marker)),
    ).map((definition) => definition.id),
  );
};

const handlerCommand = (handler: unknown): string | null =>
  isJsonRecord(handler) && typeof handler.command === 'string' ? handler.command : null;

const handlerCommandWindows = (handler: unknown): string | null =>
  isJsonRecord(handler) && typeof handler.commandWindows === 'string' ? handler.commandWindows : null;

const handlerWorkflows = (handler: unknown): CodexHookWorkflow[] => {
  const command = handlerCommand(handler);
  if (!command) {
    return [];
  }
  return parseWorkflowsFromCommand(command);
};

const commandHasWorkflowSelector = (command: string): boolean => /(?:^|\s)--workflows(?:=|\s+)/.test(command);

const handlerMatchesSharedAiOpsHook = (handler: unknown): boolean =>
  handlerCommand(handler)?.includes(SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER) === true &&
  commandHasWorkflowSelector(handlerCommand(handler) ?? '');

const handlerMatchesDefinition =
  (definition: CodexHookDefinition) =>
  (handler: unknown): boolean =>
    handlerWorkflows(handler).includes(definition.id);

const handlerMatchesAnyAiOpsHook = (handler: unknown): boolean =>
  handlerMatchesSharedAiOpsHook(handler) ||
  CODEX_HOOK_DEFINITIONS.some((definition) => handlerMatchesDefinition(definition)(handler));

const groupHasDefinitionHook =
  (definition: CodexHookDefinition) =>
  (group: unknown): boolean =>
    isJsonRecord(group) && getArray(group, 'hooks').some(handlerMatchesDefinition(definition));

const configHasDefinitionHook = (config: JsonRecord, definition: CodexHookDefinition): boolean => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return false;
  }
  return [PRE_TOOL_USE_EVENT, POST_TOOL_USE_EVENT].some((eventName) =>
    getArray(hooks, eventName).some(groupHasDefinitionHook(definition)),
  );
};

const collectConfiguredWorkflows = (config: JsonRecord): CodexHookWorkflow[] => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return [];
  }

  const workflows: CodexHookWorkflow[] = [];
  for (const eventName of [PRE_TOOL_USE_EVENT, POST_TOOL_USE_EVENT]) {
    for (const group of getArray(hooks, eventName)) {
      if (!isJsonRecord(group)) {
        continue;
      }
      for (const handler of getArray(group, 'hooks')) {
        workflows.push(...handlerWorkflows(handler));
      }
    }
  }

  return normalizeWorkflows(workflows);
};

const findSharedHookCommandConfig = (config: JsonRecord): CodexHookCommandConfig | null => {
  const hooks = config.hooks;
  if (!isJsonRecord(hooks)) {
    return null;
  }

  for (const group of getArray(hooks, POST_TOOL_USE_EVENT)) {
    if (!isJsonRecord(group)) {
      continue;
    }
    for (const handler of getArray(group, 'hooks')) {
      const command = handlerCommand(handler);
      if (!command?.includes(SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER) || !commandHasWorkflowSelector(command)) {
        continue;
      }
      const commandWindows = handlerCommandWindows(handler);
      return commandWindows ? { command, commandWindows } : { command };
    }
  }

  return null;
};

const removeAiOpsHooksFromEvent = (hooks: JsonRecord, eventName: string): boolean => {
  const previousGroups = getArray(hooks, eventName);
  let removed = false;
  const nextGroups = previousGroups
    .map((group) => {
      if (!isJsonRecord(group)) {
        return group;
      }
      const previousHandlers = getArray(group, 'hooks');
      const nextHandlers = previousHandlers.filter((handler) => {
        const matches = handlerMatchesAnyAiOpsHook(handler);
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

const replaceOrAppendWorkflows = (command: string, workflows: readonly CodexHookWorkflow[]): string => {
  const serialized = serializeWorkflows(workflows);
  if (/(^|\s)--workflows=([^\s]+)/.test(command)) {
    return command.replace(/(^|\s)--workflows=([^\s]+)/, `$1--workflows=${serialized}`);
  }
  if (/(^|\s)--workflows\s+([^\s]+)/.test(command)) {
    return command.replace(/(^|\s)--workflows\s+([^\s]+)/, `$1--workflows ${serialized}`);
  }
  return `${command} --workflows ${serialized}`;
};

const buildSharedHookCommand = (params: {
  definition: CodexHookDefinition;
  overrideCommand?: string;
  workflows: readonly CodexHookWorkflow[];
}): string => {
  const command = params.overrideCommand?.trim() ?? SHARED_POST_TOOL_USE_DEFAULT_HOOK_COMMAND;
  if (!command.includes(SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER)) {
    throw new Error(`${params.definition.id} hook command must include: ${SHARED_POST_TOOL_USE_HOOK_COMMAND_MARKER}`);
  }
  return replaceOrAppendWorkflows(command, params.workflows);
};

const buildSharedHookCommandConfig = (params: {
  definition: CodexHookDefinition;
  overrideCommand?: string;
  overrideCommandWindows?: string;
  workflows: readonly CodexHookWorkflow[];
}): CodexHookCommandConfig => {
  const command = buildSharedHookCommand({
    definition: params.definition,
    overrideCommand: params.overrideCommand,
    workflows: params.workflows,
  });
  const commandWindows = params.overrideCommandWindows?.trim();
  if (!commandWindows) {
    return { command };
  }
  return {
    command,
    commandWindows: buildSharedHookCommand({
      definition: params.definition,
      overrideCommand: commandWindows,
      workflows: params.workflows,
    }),
  };
};

const appendSharedHookGroup = (hooks: JsonRecord, commandConfig: CodexHookCommandConfig): void => {
  const existingGroups = getArray(hooks, POST_TOOL_USE_EVENT);
  const handler: JsonRecord = {
    type: 'command',
    command: commandConfig.command,
    timeout: 30,
    statusMessage: SHARED_POST_TOOL_USE_STATUS_MESSAGE,
  };
  if (commandConfig.commandWindows) {
    handler.commandWindows = commandConfig.commandWindows;
  }

  hooks[POST_TOOL_USE_EVENT] = [
    ...existingGroups,
    {
      matcher: BASH_MATCHER,
      hooks: [handler],
    },
  ];
};

const buildConfigWithSharedAiOpsHook = (params: {
  config: JsonRecord;
  workflows: readonly CodexHookWorkflow[];
  commandConfig?: CodexHookCommandConfig;
}): JsonRecord => {
  const nextConfig = cloneJsonRecord(params.config);
  const existingHooks = nextConfig.hooks;

  const workflows = normalizeWorkflows(params.workflows);
  if (!isJsonRecord(existingHooks) && workflows.length === 0) {
    return nextConfig;
  }

  const hooks = getOrCreateRecord(nextConfig, 'hooks');
  removeAiOpsHooksFromEvent(hooks, PRE_TOOL_USE_EVENT);
  removeAiOpsHooksFromEvent(hooks, POST_TOOL_USE_EVENT);

  if (workflows.length > 0) {
    if (!params.commandConfig) {
      throw new Error('command config is required when installing ai-ops workflows');
    }
    appendSharedHookGroup(hooks, params.commandConfig);
  }

  return nextConfig;
};

// ----- public API -----

export const resolveCodexHooksPath = (codexHomePath: string): string => join(codexHomePath, 'hooks.json');

export const buildCodexHookCommand = (params: {
  definition: CodexHookDefinition;
  overrideCommand?: string;
  workflows?: readonly CodexHookWorkflow[];
}): string => {
  return buildCodexHookCommands(params).command;
};

export const buildCodexHookCommands = (params: {
  definition: CodexHookDefinition;
  overrideCommand?: string;
  overrideCommandWindows?: string;
  workflows?: readonly CodexHookWorkflow[];
}): CodexHookCommandConfig => {
  const workflows = normalizeWorkflows(params.workflows ?? [params.definition.id]);
  return buildSharedHookCommandConfig({
    definition: params.definition,
    overrideCommand: params.overrideCommand,
    overrideCommandWindows: params.overrideCommandWindows,
    workflows,
  });
};

export const buildContextPromotionHookCommand = (overrideCommand?: string): string =>
  buildCodexHookCommands({
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
    overrideCommand,
  }).command;

export const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const inspectCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
}): CodexHookStatusResult => {
  const installed = configHasDefinitionHook(readJsonRecord(params.hooksPath), params.definition);
  return {
    hooksPath: params.hooksPath,
    installed,
    trustReviewHint: installed ? CODEX_HOOK_TRUST_REVIEW_HINT : null,
  };
};

export const inspectContextPromotionHook = (hooksPath: string): CodexHookStatusResult => ({
  ...inspectCodexHook({ hooksPath, definition: CONTEXT_PROMOTION_CODEX_HOOK }),
});

export const installCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
  command?: string;
  commandWindows?: string;
}): CodexHookInstallResult => {
  const config = readJsonRecord(params.hooksPath);
  const existingCommandConfig = findSharedHookCommandConfig(config);
  const workflows = normalizeWorkflows([...collectConfiguredWorkflows(config), params.definition.id]);
  const commandConfig = buildCodexHookCommands({
    definition: params.definition,
    overrideCommand: params.command ?? existingCommandConfig?.command,
    overrideCommandWindows: params.commandWindows ?? existingCommandConfig?.commandWindows,
    workflows,
  });
  const nextConfig = buildConfigWithSharedAiOpsHook({
    config,
    workflows,
    commandConfig,
  });
  const changed = !recordsMatch(config, nextConfig);
  if (changed) {
    writeJsonRecord(params.hooksPath, nextConfig);
  }

  return {
    hooksPath: params.hooksPath,
    installed: true,
    changed,
    command: commandConfig.command,
    commandWindows: commandConfig.commandWindows ?? null,
    workflows,
  };
};

export const installContextPromotionHook = (params: {
  hooksPath: string;
  command?: string;
  commandWindows?: string;
}): CodexHookInstallResult =>
  installCodexHook({
    hooksPath: params.hooksPath,
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
    command: params.command,
    commandWindows: params.commandWindows,
  });

export const uninstallCodexHook = (params: {
  hooksPath: string;
  definition: CodexHookDefinition;
}): CodexHookUninstallResult => {
  const config = readJsonRecord(params.hooksPath);
  const previousWorkflows = collectConfiguredWorkflows(config);
  const workflows = previousWorkflows.filter((workflow) => workflow !== params.definition.id);
  const existingCommandConfig = findSharedHookCommandConfig(config);
  const commandConfig =
    workflows.length > 0
      ? buildCodexHookCommands({
          definition: params.definition,
          overrideCommand: existingCommandConfig?.command,
          overrideCommandWindows: existingCommandConfig?.commandWindows,
          workflows,
        })
      : undefined;
  const nextConfig = buildConfigWithSharedAiOpsHook({
    config,
    workflows,
    commandConfig,
  });
  const changed = !recordsMatch(config, nextConfig);
  if (changed) {
    writeJsonRecord(params.hooksPath, nextConfig);
  }

  return {
    hooksPath: params.hooksPath,
    removed: previousWorkflows.includes(params.definition.id),
    changed,
    workflows,
  };
};

export const uninstallContextPromotionHook = (hooksPath: string): CodexHookUninstallResult =>
  uninstallCodexHook({
    hooksPath,
    definition: CONTEXT_PROMOTION_CODEX_HOOK,
  });
