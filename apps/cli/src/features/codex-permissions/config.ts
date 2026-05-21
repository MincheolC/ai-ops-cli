import { join } from "node:path";
import type { CodexSafePermissionPaths, ConfigEditResult } from "./types.js";
import { CONFIG_CONFLICT_DEFAULT_PERMISSIONS, CONFIG_CONFLICT_EXISTING_PROFILE, CONFIG_CONFLICT_SANDBOX, LEGACY_CONFIG_BLOCK_END, LEGACY_CONFIG_BLOCK_START, LEGACY_WRITABLE_ROOTS_BLOCK_END, LEGACY_WRITABLE_ROOTS_BLOCK_START, PROFILE_BLOCK_END, PROFILE_BLOCK_START, SAFE_LOCAL_CODEX_PERMISSION_NAME } from "./types.js";
import { findTableRange, hasActiveTable, hasActiveTablePrefix, quoteTomlString, readActiveStringAssignment, replaceOrAppendBlock, stripBlock } from "./file-utils.js";

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
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem.":project_roots"]`,
    '"." = "write"',
    '".git" = "read"',
    '".codex" = "read"',
    '".codex/plans" = "write"',
    '"**/*.env" = "none"',
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

export const editConfigForInstall = (content: string, paths: CodexSafePermissionPaths): ConfigEditResult => {
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

export const editConfigForUninstall = (content: string): ConfigEditResult => {
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

export const inspectConfig = (content: string, paths: CodexSafePermissionPaths): ConfigEditResult => {
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
