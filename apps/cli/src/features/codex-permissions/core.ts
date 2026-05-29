import { readTextFileOrEmpty, buildFileStatus, writeTextFile } from "./file-utils.js";
import { cleanupLegacyHookConfig, cleanupLegacyRules, inspectLegacyHookConfig, inspectLegacyRules } from "./legacy-cleanup.js";
import { editConfigForInstall, editConfigForUninstall, inspectConfig } from "./config.js";
import { createCodexRuntimePermissionProfileValidator } from "./runtime-validator.js";
import { resolveCodexConfigPath, resolveCodexHooksPathForPermissions, resolveCodexRulesPath } from "./types.js";
import type { CodexPermissionProfileValidator, CodexSafePermissionPaths, CodexSafePermissionStatus } from "./types.js";

export * from "./types.js";

// ----- public lifecycle -----

export type CodexSafePermissionsOptions = {
  validateProfileCandidate?: CodexPermissionProfileValidator;
};

const resolveProfileCandidateValidator = (options?: CodexSafePermissionsOptions): CodexPermissionProfileValidator =>
  options?.validateProfileCandidate ?? createCodexRuntimePermissionProfileValidator();

export const installCodexSafePermissions = (
  paths: CodexSafePermissionPaths,
  options?: CodexSafePermissionsOptions,
): CodexSafePermissionStatus => {
  const configPath = resolveCodexConfigPath(paths.codexHomePath);
  const rulesPath = resolveCodexRulesPath(paths.codexHomePath);
  const hooksPath = resolveCodexHooksPathForPermissions(paths.codexHomePath);

  const configEdit = editConfigForInstall(readTextFileOrEmpty(configPath), paths, resolveProfileCandidateValidator(options));
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

export const inspectCodexSafePermissions = (
  paths: CodexSafePermissionPaths,
  options?: CodexSafePermissionsOptions,
): CodexSafePermissionStatus => {
  const configPath = resolveCodexConfigPath(paths.codexHomePath);
  const rulesPath = resolveCodexRulesPath(paths.codexHomePath);
  const hooksPath = resolveCodexHooksPathForPermissions(paths.codexHomePath);

  return {
    config: buildFileStatus({
      path: configPath,
      ...inspectConfig(readTextFileOrEmpty(configPath), paths, resolveProfileCandidateValidator(options)),
    }),
    rules: buildFileStatus({ path: rulesPath, ...inspectLegacyRules(readTextFileOrEmpty(rulesPath)) }),
    hook: inspectLegacyHookConfig(hooksPath),
  };
};
