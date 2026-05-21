import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ----- types -----

export const CODEX_PERMISSION_PROFILE = {
  SAFE_LOCAL: 'safe-local',
} as const;

export type CodexPermissionProfile = (typeof CODEX_PERMISSION_PROFILE)[keyof typeof CODEX_PERMISSION_PROFILE];

export type CodexSafePermissionPaths = {
  codexHomePath: string;
  userBasePath: string;
  personalContextRoot: string;
};

export type CodexSafePermissionFileStatus = {
  path: string;
  installed: boolean;
  changed: boolean;
  conflict: string | null;
};

export type CodexSafePermissionStatus = {
  config: CodexSafePermissionFileStatus;
  rules: CodexSafePermissionFileStatus;
  hook: CodexSafePermissionFileStatus;
};

type ConfigEditResult = {
  content: string;
  installed: boolean;
  changed: boolean;
  conflict: string | null;
};

type HookCleanupResult = {
  config: Record<string, unknown>;
  removed: boolean;
};

// ----- constants -----

export const SAFE_LOCAL_CODEX_PERMISSION_NAME = 'ai-ops-safe-local';

const PROFILE_BLOCK_START = '# ai-ops:safe-permissions:profile:start';
const PROFILE_BLOCK_END = '# ai-ops:safe-permissions:profile:end';

const LEGACY_CONFIG_BLOCK_START = '# ai-ops:safe-permissions:config:start';
const LEGACY_CONFIG_BLOCK_END = '# ai-ops:safe-permissions:config:end';
const LEGACY_WRITABLE_ROOTS_BLOCK_START = '# ai-ops:safe-permissions:writable-roots:start';
const LEGACY_WRITABLE_ROOTS_BLOCK_END = '# ai-ops:safe-permissions:writable-roots:end';
const LEGACY_RULES_BLOCK_START = '# ai-ops:safe-permissions:start';
const LEGACY_RULES_BLOCK_END = '# ai-ops:safe-permissions:end';
const LEGACY_PERMISSION_HOOK_MARKER = 'codex-permissions hook permission-request safe-local';

const PERMISSION_REQUEST_EVENT = 'PermissionRequest';

const CONFIG_CONFLICT_SANDBOX =
  'sandbox_mode/sandbox_workspace_write is active; safe-local v2 uses permission profiles and cannot mix with older sandbox settings';
const CONFIG_CONFLICT_DEFAULT_PERMISSIONS =
  'default_permissions is already set to another profile; safe-local v2 will not replace user-owned permission defaults';
const CONFIG_CONFLICT_EXISTING_PROFILE =
  'permissions.ai-ops-safe-local already exists outside the ai-ops managed block; safe-local v2 will not rewrite user-owned profile tables';

// ----- filesystem paths -----

export const resolveCodexConfigPath = (codexHomePath: string): string => join(codexHomePath, 'config.toml');

export const resolveCodexRulesPath = (codexHomePath: string): string => join(codexHomePath, 'rules', 'default.rules');

export const resolveCodexHooksPathForPermissions = (codexHomePath: string): string => join(codexHomePath, 'hooks.json');

// ----- shared helpers -----

const isNodeFileNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  return error.code === 'ENOENT';
};

const readTextFileOrEmpty = (filePath: string): string => {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return '';
    }
    throw error;
  }
};

const writeTextFile = (filePath: string, content: string): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
};

const isJsonRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readJsonRecord = (filePath: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!isJsonRecord(parsed)) {
      throw new Error('hooks.json must contain a JSON object');
    }
    return parsed;
  } catch (error) {
    if (isNodeFileNotFoundError(error)) {
      return {};
    }
    throw error;
  }
};

const getArray = (record: Record<string, unknown>, key: string): unknown[] => {
  const existing = record[key];
  return Array.isArray(existing) ? existing : [];
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripBlock = (content: string, start: string, end: string): string => {
  const pattern = new RegExp(`\\n?${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
  return content.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trimStart();
};

const hasBlock = (content: string, start: string, end: string): boolean => {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  return pattern.test(content);
};

const replaceOrAppendBlock = (content: string, start: string, end: string, block: string): string => {
  const cleanBlock = block.endsWith('\n') ? block : `${block}\n`;
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'g');
  if (pattern.test(content)) {
    return content.replace(pattern, cleanBlock);
  }
  const separator = content.trim().length > 0 && !content.endsWith('\n') ? '\n\n' : content.length > 0 ? '\n' : '';
  return `${content}${separator}${cleanBlock}`;
};

const quoteTomlString = (value: string): string => JSON.stringify(value);

const readActiveStringAssignment = (content: string, key: string): string | null => {
  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('#')) {
      continue;
    }
    const match = new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`).exec(line);
    if (match) {
      return match[1];
    }
  }
  return null;
};

const hasActiveTable = (content: string, tableName: string): boolean => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*(?:#.*)?$`);
  return content.split('\n').some((line) => !line.trimStart().startsWith('#') && tablePattern.test(line));
};

const hasActiveTablePrefix = (content: string, tablePrefix: string): boolean => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tablePrefix)}(?:\\.|\\])`);
  return content.split('\n').some((line) => !line.trimStart().startsWith('#') && tablePattern.test(line));
};

const findTableRange = (lines: readonly string[], tableName: string): { start: number; end: number } | null => {
  const tablePattern = new RegExp(`^\\s*\\[${escapeRegExp(tableName)}\\]\\s*(?:#.*)?$`);
  const start = lines.findIndex((line) => tablePattern.test(line));
  if (start < 0) {
    return null;
  }
  const nextTable = lines.findIndex((line, index) => index > start && /^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(line));
  return {
    start,
    end: nextTable < 0 ? lines.length : nextTable,
  };
};

const buildFileStatus = (params: {
  path: string;
  installed: boolean;
  changed: boolean;
  conflict: string | null;
}): CodexSafePermissionFileStatus => ({
  path: params.path,
  installed: params.installed,
  changed: params.changed,
  conflict: params.conflict,
});

// ----- config.toml management -----

const buildPermissionProfileBlock = (paths: CodexSafePermissionPaths, includeDefaultPermissions: boolean): string =>
  [
    PROFILE_BLOCK_START,
    ...(includeDefaultPermissions ? [`default_permissions = ${quoteTomlString(SAFE_LOCAL_CODEX_PERMISSION_NAME)}`, ''] : []),
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}]`,
    '',
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem]`,
    'glob_scan_max_depth = 3',
    '":minimal" = "read"',
    `${quoteTomlString(paths.personalContextRoot)} = "write"`,
    `${quoteTomlString(join(paths.userBasePath, '.ai-ops', 'context-promotion'))} = "write"`,
    '',
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem.":workspace_roots"]`,
    '"." = "write"',
    '".git" = "read"',
    '".codex" = "read"',
    '".codex/plans" = "write"',
    '"**/*.env" = "deny"',
    '',
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.network]`,
    'enabled = false',
    PROFILE_BLOCK_END,
    '',
  ].join('\n');

const stripLegacySandboxModeBlock = (content: string): string =>
  stripBlock(content, LEGACY_CONFIG_BLOCK_START, LEGACY_CONFIG_BLOCK_END);

const removeLegacyManagedSandboxWorkspaceWriteTable = (content: string): string => {
  const lines = content.split('\n');
  const tableRange = findTableRange(lines, 'sandbox_workspace_write');
  if (!tableRange) {
    return content;
  }

  const tableText = lines.slice(tableRange.start, tableRange.end).join('\n');
  if (!tableText.includes(LEGACY_WRITABLE_ROOTS_BLOCK_START) || !tableText.includes(LEGACY_WRITABLE_ROOTS_BLOCK_END)) {
    return content;
  }

  const tableWithoutManagedRoots = stripBlock(
    tableText,
    `  ${LEGACY_WRITABLE_ROOTS_BLOCK_START}`,
    `  ${LEGACY_WRITABLE_ROOTS_BLOCK_END}`,
  );
  const residue = tableWithoutManagedRoots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  const isOnlyManagedWritableRootsTable =
    residue.length === 3 &&
    residue[0] === '[sandbox_workspace_write]' &&
    residue[1] === 'writable_roots = [' &&
    residue[2] === ']';

  if (!isOnlyManagedWritableRootsTable) {
    return content;
  }

  const nextLines = [...lines.slice(0, tableRange.start), ...lines.slice(tableRange.end)];
  return `${nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trimStart().trimEnd()}\n`;
};

const cleanupLegacySandboxConfig = (content: string): string =>
  removeLegacyManagedSandboxWorkspaceWriteTable(stripLegacySandboxModeBlock(content));

const editConfigForInstall = (content: string, paths: CodexSafePermissionPaths): ConfigEditResult => {
  const withoutCurrentProfileBlock = stripBlock(content, PROFILE_BLOCK_START, PROFILE_BLOCK_END);
  const withoutLegacy = cleanupLegacySandboxConfig(withoutCurrentProfileBlock);
  const activeDefaultPermissions = readActiveStringAssignment(withoutLegacy, 'default_permissions');

  if (readActiveStringAssignment(withoutLegacy, 'sandbox_mode') || hasActiveTable(withoutLegacy, 'sandbox_workspace_write')) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_SANDBOX,
    };
  }

  if (activeDefaultPermissions && activeDefaultPermissions !== SAFE_LOCAL_CODEX_PERMISSION_NAME) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_DEFAULT_PERMISSIONS,
    };
  }

  if (hasActiveTablePrefix(withoutLegacy, `permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}`)) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_EXISTING_PROFILE,
    };
  }

  const nextContent = replaceOrAppendBlock(
    withoutLegacy,
    PROFILE_BLOCK_START,
    PROFILE_BLOCK_END,
    buildPermissionProfileBlock(paths, activeDefaultPermissions !== SAFE_LOCAL_CODEX_PERMISSION_NAME),
  );

  return {
    content: nextContent,
    installed: true,
    changed: nextContent !== content,
    conflict: null,
  };
};

const editConfigForUninstall = (content: string): ConfigEditResult => {
  const withoutProfile = stripBlock(content, PROFILE_BLOCK_START, PROFILE_BLOCK_END);
  const withoutLegacy = cleanupLegacySandboxConfig(withoutProfile);
  const nextContent = withoutLegacy.trim().length > 0 ? `${withoutLegacy.trimEnd()}\n` : '';
  return {
    content: nextContent,
    installed: false,
    changed: nextContent !== content,
    conflict: null,
  };
};

const inspectConfig = (content: string, paths: CodexSafePermissionPaths): ConfigEditResult => {
  const edited = editConfigForInstall(content, paths);
  if (edited.conflict) {
    return edited;
  }
  return {
    content,
    installed: !edited.changed,
    changed: false,
    conflict: null,
  };
};

// ----- rules/default.rules legacy cleanup -----

const cleanupLegacyRules = (content: string): ConfigEditResult => {
  const nextContent = stripBlock(content, LEGACY_RULES_BLOCK_START, LEGACY_RULES_BLOCK_END);
  return {
    content: nextContent,
    installed: true,
    changed: nextContent !== content,
    conflict: null,
  };
};

const inspectLegacyRules = (content: string): ConfigEditResult => ({
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

const cleanupLegacyHookConfig = (hooksPath: string): CodexSafePermissionFileStatus => {
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

const inspectLegacyHookConfig = (hooksPath: string): CodexSafePermissionFileStatus => {
  const config = readJsonRecord(hooksPath);
  return buildFileStatus({
    path: hooksPath,
    installed: !configHasLegacySafeLocalPermissionHook(config),
    changed: false,
    conflict: null,
  });
};

// ----- public lifecycle -----

export const installCodexSafePermissions = (paths: CodexSafePermissionPaths): CodexSafePermissionStatus => {
  const configPath = resolveCodexConfigPath(paths.codexHomePath);
  const rulesPath = resolveCodexRulesPath(paths.codexHomePath);
  const hooksPath = resolveCodexHooksPathForPermissions(paths.codexHomePath);

  const configEdit = editConfigForInstall(readTextFileOrEmpty(configPath), paths);
  if (configEdit.conflict) {
    return {
      config: buildFileStatus({ path: configPath, ...configEdit }),
      rules: buildFileStatus({ path: rulesPath, ...inspectLegacyRules(readTextFileOrEmpty(rulesPath)) }),
      hook: inspectLegacyHookConfig(hooksPath),
    };
  }
  if (configEdit.changed) {
    writeTextFile(configPath, configEdit.content);
  }

  const rulesEdit = cleanupLegacyRules(readTextFileOrEmpty(rulesPath));
  if (rulesEdit.changed) {
    writeTextFile(rulesPath, rulesEdit.content);
  }

  return {
    config: buildFileStatus({ path: configPath, ...configEdit }),
    rules: buildFileStatus({ path: rulesPath, ...rulesEdit }),
    hook: cleanupLegacyHookConfig(hooksPath),
  };
};

export const uninstallCodexSafePermissions = (paths: CodexSafePermissionPaths): CodexSafePermissionStatus => {
  const configPath = resolveCodexConfigPath(paths.codexHomePath);
  const rulesPath = resolveCodexRulesPath(paths.codexHomePath);
  const hooksPath = resolveCodexHooksPathForPermissions(paths.codexHomePath);

  const configEdit = editConfigForUninstall(readTextFileOrEmpty(configPath));
  if (configEdit.changed) {
    writeTextFile(configPath, configEdit.content);
  }

  const rulesEdit = cleanupLegacyRules(readTextFileOrEmpty(rulesPath));
  if (rulesEdit.changed) {
    writeTextFile(rulesPath, rulesEdit.content);
  }

  return {
    config: buildFileStatus({ path: configPath, ...configEdit }),
    rules: buildFileStatus({ path: rulesPath, ...rulesEdit }),
    hook: cleanupLegacyHookConfig(hooksPath),
  };
};

export const inspectCodexSafePermissions = (paths: CodexSafePermissionPaths): CodexSafePermissionStatus => {
  const configPath = resolveCodexConfigPath(paths.codexHomePath);
  const rulesPath = resolveCodexRulesPath(paths.codexHomePath);
  const hooksPath = resolveCodexHooksPathForPermissions(paths.codexHomePath);

  return {
    config: buildFileStatus({ path: configPath, ...inspectConfig(readTextFileOrEmpty(configPath), paths) }),
    rules: buildFileStatus({ path: rulesPath, ...inspectLegacyRules(readTextFileOrEmpty(rulesPath)) }),
    hook: inspectLegacyHookConfig(hooksPath),
  };
};
