import { join } from 'node:path';
import type {
  CodexPermissionProfileSyntax,
  CodexPermissionProfileValidator,
  CodexSafePermissionPaths,
  ConfigEditResult,
} from './types.js';
import {
  CODEX_PERMISSION_PROFILE_SYNTAX,
  CONFIG_CONFLICT_DEFAULT_PERMISSIONS,
  CONFIG_CONFLICT_EXISTING_PROFILE,
  CONFIG_CONFLICT_NO_VALID_PROFILE,
  CONFIG_CONFLICT_SANDBOX,
  CONFIG_WARNING_COMPAT_PROFILE_SELECTED,
  CONFIG_WARNING_VALIDATOR_UNAVAILABLE,
  LEGACY_CONFIG_BLOCK_END,
  LEGACY_CONFIG_BLOCK_START,
  LEGACY_WRITABLE_ROOTS_BLOCK_END,
  LEGACY_WRITABLE_ROOTS_BLOCK_START,
  PROFILE_BLOCK_END,
  PROFILE_BLOCK_START,
  SAFE_LOCAL_CODEX_PERMISSION_NAME,
} from './types.js';
import {
  findTableRange,
  hasActiveTable,
  hasActiveTablePrefix,
  insertBlockBeforeFirstTable,
  quoteTomlString,
  readActiveStringAssignment,
  readTopLevelStringAssignment,
  replaceOrAppendBlock,
  stripBlock,
} from './file-utils.js';

// ----- config.toml management -----

const SAFE_LOCAL_BASE_WORKSPACE_RULES = [
  { path: '.', access: 'write' },
  { path: '.git', access: 'read' },
  { path: '.codex', access: 'read' },
  { path: '.codex/plans', access: 'write' },
] as const;

const SAFE_LOCAL_EXACT_ENV_NONE_RULES = [
  { path: '.env', access: 'none' },
  { path: '.env.local', access: 'none' },
  { path: '.env.development', access: 'none' },
  { path: '.env.test', access: 'none' },
  { path: '.env.production', access: 'none' },
] as const;

const SAFE_LOCAL_FALLBACK_PROFILE_SYNTAX: CodexPermissionProfileSyntax = {
  id: CODEX_PERMISSION_PROFILE_SYNTAX.CODEX_0_130_PROJECT_ROOTS_EXACT_ENV_NONE,
  workspaceRootToken: ':project_roots',
  workspaceRules: [...SAFE_LOCAL_BASE_WORKSPACE_RULES, ...SAFE_LOCAL_EXACT_ENV_NONE_RULES],
};

const SAFE_LOCAL_PROFILE_SYNTAX_CANDIDATES: readonly CodexPermissionProfileSyntax[] = [
  {
    id: CODEX_PERMISSION_PROFILE_SYNTAX.DOCS_WORKSPACE_ROOTS_DENY,
    workspaceRootToken: ':workspace_roots',
    workspaceRules: [...SAFE_LOCAL_BASE_WORKSPACE_RULES, { path: '**/*.env', access: 'deny' }],
  },
  SAFE_LOCAL_FALLBACK_PROFILE_SYNTAX,
  {
    id: CODEX_PERMISSION_PROFILE_SYNTAX.CODEX_0_130_PROJECT_ROOTS_GLOB_ENV_NONE,
    workspaceRootToken: ':project_roots',
    workspaceRules: [...SAFE_LOCAL_BASE_WORKSPACE_RULES, { path: '**/*.env', access: 'none' }],
  },
] as const;

export const unavailableCodexPermissionProfileValidator: CodexPermissionProfileValidator = () => ({
  available: false,
  message: 'codex command is unavailable',
});

const buildPermissionProfileBlock = (
  paths: CodexSafePermissionPaths,
  includeDefaultPermissions: boolean,
  syntax: CodexPermissionProfileSyntax,
): string =>
  [
    PROFILE_BLOCK_START,
    ...(includeDefaultPermissions
      ? [`default_permissions = ${quoteTomlString(SAFE_LOCAL_CODEX_PERMISSION_NAME)}`, '']
      : []),
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}]`,
    '',
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem]`,
    'glob_scan_max_depth = 3',
    '":minimal" = "read"',
    `${quoteTomlString(paths.personalContextRoot)} = "write"`,
    `${quoteTomlString(join(paths.userBasePath, '.ai-ops', 'context-promotion'))} = "write"`,
    '',
    `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem.${quoteTomlString(syntax.workspaceRootToken)}]`,
    ...syntax.workspaceRules.map((rule) => `${quoteTomlString(rule.path)} = ${quoteTomlString(rule.access)}`),
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
  return `${nextLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimStart()
    .trimEnd()}\n`;
};

const cleanupLegacySandboxConfig = (content: string): string =>
  removeLegacyManagedSandboxWorkspaceWriteTable(stripLegacySandboxModeBlock(content));

const buildValidationConfig = (paths: CodexSafePermissionPaths, syntax: CodexPermissionProfileSyntax): string =>
  buildPermissionProfileBlock(paths, true, syntax);

const selectPermissionProfileSyntax = (
  paths: CodexSafePermissionPaths,
  validateProfileCandidate: CodexPermissionProfileValidator,
): { syntax: CodexPermissionProfileSyntax; warning: string | null; conflict: string | null } => {
  const failures: string[] = [];
  for (const syntax of SAFE_LOCAL_PROFILE_SYNTAX_CANDIDATES) {
    const validation = validateProfileCandidate({
      syntax,
      validationConfig: buildValidationConfig(paths, syntax),
    });
    if (!validation.available) {
      return {
        syntax: SAFE_LOCAL_FALLBACK_PROFILE_SYNTAX,
        warning: CONFIG_WARNING_VALIDATOR_UNAVAILABLE,
        conflict: null,
      };
    }
    if (validation.valid) {
      return {
        syntax,
        warning:
          syntax.id === CODEX_PERMISSION_PROFILE_SYNTAX.DOCS_WORKSPACE_ROOTS_DENY
            ? null
            : CONFIG_WARNING_COMPAT_PROFILE_SELECTED,
        conflict: null,
      };
    }
    failures.push(`${syntax.id}: ${validation.message ?? 'invalid'}`);
  }

  const suffix = failures.length > 0 ? ` (${failures.join('; ')})` : '';
  return {
    syntax: SAFE_LOCAL_FALLBACK_PROFILE_SYNTAX,
    warning: null,
    conflict: `${CONFIG_CONFLICT_NO_VALID_PROFILE}${suffix}`,
  };
};

export const editConfigForInstall = (
  content: string,
  paths: CodexSafePermissionPaths,
  validateProfileCandidate: CodexPermissionProfileValidator = unavailableCodexPermissionProfileValidator,
): ConfigEditResult => {
  const withoutCurrentProfileBlock = stripBlock(content, PROFILE_BLOCK_START, PROFILE_BLOCK_END);
  const withoutLegacy = cleanupLegacySandboxConfig(withoutCurrentProfileBlock);
  const activeDefaultPermissions = readTopLevelStringAssignment(withoutLegacy, 'default_permissions');

  if (
    readActiveStringAssignment(withoutLegacy, 'sandbox_mode') ||
    hasActiveTable(withoutLegacy, 'sandbox_workspace_write')
  ) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_SANDBOX,
      warning: null,
    };
  }

  if (activeDefaultPermissions && activeDefaultPermissions !== SAFE_LOCAL_CODEX_PERMISSION_NAME) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_DEFAULT_PERMISSIONS,
      warning: null,
    };
  }

  if (hasActiveTablePrefix(withoutLegacy, `permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}`)) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: CONFIG_CONFLICT_EXISTING_PROFILE,
      warning: null,
    };
  }

  const selectedSyntax = selectPermissionProfileSyntax(paths, validateProfileCandidate);
  if (selectedSyntax.conflict) {
    return {
      content,
      installed: false,
      changed: false,
      conflict: selectedSyntax.conflict,
      warning: null,
    };
  }

  const shouldWriteDefaultPermissions = activeDefaultPermissions !== SAFE_LOCAL_CODEX_PERMISSION_NAME;
  const profileBlock = buildPermissionProfileBlock(paths, shouldWriteDefaultPermissions, selectedSyntax.syntax);
  const nextContent = shouldWriteDefaultPermissions
    ? insertBlockBeforeFirstTable(withoutLegacy, profileBlock)
    : replaceOrAppendBlock(withoutLegacy, PROFILE_BLOCK_START, PROFILE_BLOCK_END, profileBlock);

  return {
    content: nextContent,
    installed: true,
    changed: nextContent !== content,
    conflict: null,
    warning: selectedSyntax.warning,
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
    warning: null,
  };
};

export const inspectConfig = (
  content: string,
  paths: CodexSafePermissionPaths,
  validateProfileCandidate: CodexPermissionProfileValidator = unavailableCodexPermissionProfileValidator,
): ConfigEditResult => {
  const edited = editConfigForInstall(content, paths, validateProfileCandidate);
  if (edited.conflict) {
    return edited;
  }
  return {
    content,
    installed: !edited.changed,
    changed: false,
    conflict: null,
    warning: edited.warning,
  };
};
