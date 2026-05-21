import { join } from "node:path";

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

export type ConfigEditResult = {
  content: string;
  installed: boolean;
  changed: boolean;
  conflict: string | null;
};

export type HookCleanupResult = {
  config: Record<string, unknown>;
  removed: boolean;
};

// ----- constants -----

export const SAFE_LOCAL_CODEX_PERMISSION_NAME = 'ai-ops-safe-local';

export const PROFILE_BLOCK_START = '# ai-ops:safe-permissions:profile:start';
export const PROFILE_BLOCK_END = '# ai-ops:safe-permissions:profile:end';

export const LEGACY_CONFIG_BLOCK_START = '# ai-ops:safe-permissions:config:start';
export const LEGACY_CONFIG_BLOCK_END = '# ai-ops:safe-permissions:config:end';
export const LEGACY_WRITABLE_ROOTS_BLOCK_START = '# ai-ops:safe-permissions:writable-roots:start';
export const LEGACY_WRITABLE_ROOTS_BLOCK_END = '# ai-ops:safe-permissions:writable-roots:end';
export const LEGACY_RULES_BLOCK_START = '# ai-ops:safe-permissions:start';
export const LEGACY_RULES_BLOCK_END = '# ai-ops:safe-permissions:end';
export const LEGACY_PERMISSION_HOOK_MARKER = 'codex-permissions hook permission-request safe-local';

export const PERMISSION_REQUEST_EVENT = 'PermissionRequest';

export const CONFIG_CONFLICT_SANDBOX =
  'sandbox_mode/sandbox_workspace_write is active; safe-local v2 uses permission profiles and cannot mix with older sandbox settings';
export const CONFIG_CONFLICT_DEFAULT_PERMISSIONS =
  'default_permissions is already set to another profile; safe-local v2 will not replace user-owned permission defaults';
export const CONFIG_CONFLICT_EXISTING_PROFILE =
  'permissions.ai-ops-safe-local already exists outside the ai-ops managed block; safe-local v2 will not rewrite user-owned profile tables';

// ----- filesystem paths -----

export const resolveCodexConfigPath = (codexHomePath: string): string => join(codexHomePath, 'config.toml');

export const resolveCodexRulesPath = (codexHomePath: string): string => join(codexHomePath, 'rules', 'default.rules');

export const resolveCodexHooksPathForPermissions = (codexHomePath: string): string => join(codexHomePath, 'hooks.json');
