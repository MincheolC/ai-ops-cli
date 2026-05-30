import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  CODEX_PERMISSION_PROFILE_SYNTAX,
  CONFIG_CONFLICT_NO_VALID_PROFILE,
  CONFIG_WARNING_VALIDATOR_UNAVAILABLE,
  inspectCodexSafePermissions,
  installCodexSafePermissions,
  PROFILE_BLOCK_END,
  PROFILE_BLOCK_START,
  resolveCodexConfigPath,
  resolveCodexHooksPathForPermissions,
  resolveCodexRulesPath,
  SAFE_LOCAL_CODEX_PERMISSION_NAME,
  type CodexPermissionProfileValidator,
  uninstallCodexSafePermissions,
} from '../../features/codex-permissions/core.js';

const setup = (): {
  codexHomePath: string;
  userBasePath: string;
  homePath: string;
  personalContextRoot: string;
  cleanup: () => void;
} => {
  const dir = mkdtempSync(join(tmpdir(), 'codex-permissions-test-'));
  const homePath = join(dir, 'home');
  return {
    codexHomePath: join(homePath, '.codex'),
    userBasePath: join(homePath, '.ai-ops-home'),
    homePath,
    personalContextRoot: join(homePath, '.personal-project-contexts'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const writeLegacySafeLocalFiles = (paths: ReturnType<typeof setup>): void => {
  mkdirSync(join(paths.codexHomePath, 'rules'), { recursive: true });
  writeFileSync(
    resolveCodexConfigPath(paths.codexHomePath),
    [
      '# ai-ops:safe-permissions:config:start',
      'sandbox_mode = "workspace-write"',
      '# ai-ops:safe-permissions:config:end',
      '',
      '[sandbox_workspace_write]',
      'writable_roots = [',
      '  # ai-ops:safe-permissions:writable-roots:start',
      `  "${paths.personalContextRoot}",`,
      '  # ai-ops:safe-permissions:writable-roots:end',
      ']',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    resolveCodexRulesPath(paths.codexHomePath),
    [
      'prefix_rule(pattern = ["keep"], decision = "prompt")',
      '',
      '# ai-ops:safe-permissions:start',
      'prefix_rule(pattern = ["ai-ops", "pc", "done"], decision = "allow")',
      '# ai-ops:safe-permissions:end',
      '',
    ].join('\n'),
    'utf-8',
  );
  writeFileSync(
    resolveCodexHooksPathForPermissions(paths.codexHomePath),
    `${JSON.stringify(
      {
        hooks: {
          PermissionRequest: [
            {
              matcher: '^Bash$',
              hooks: [
                {
                  type: 'command',
                  command: 'ai-ops codex-permissions hook permission-request safe-local',
                },
              ],
            },
          ],
          PostToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'echo keep' }] }],
        },
      },
      null,
      2,
    )}\n`,
    'utf-8',
  );
};

const createSyntaxValidator =
  (...validSyntaxIds: readonly string[]): CodexPermissionProfileValidator =>
  (candidate) => {
    const valid = validSyntaxIds.includes(candidate.syntax.id);
    return {
      available: true,
      valid,
      message: valid ? null : `${candidate.syntax.id} rejected`,
    };
  };

const unavailableValidator: CodexPermissionProfileValidator = () => ({
  available: false,
  message: 'codex command is unavailable',
});

const docsSyntaxOptions = {
  validateProfileCandidate: createSyntaxValidator(CODEX_PERMISSION_PROFILE_SYNTAX.DOCS_WORKSPACE_ROOTS_DENY),
};

describe('Codex safe permissions profile config', () => {
  it('installs a safe-local permission profile into missing Codex files idempotently', () => {
    const paths = setup();
    try {
      const result = installCodexSafePermissions(paths, docsSyntaxOptions);
      const second = installCodexSafePermissions(paths, docsSyntaxOptions);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.changed).toBe(true);
      expect(result.config.warning).toBe(null);
      expect(second.config.changed).toBe(false);
      expect(config).toContain(`default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`);
      expect(config).toContain(`[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}]`);
      expect(config).toContain('":minimal" = "read"');
      expect(config).toContain(`"${paths.personalContextRoot}" = "write"`);
      expect(config).not.toContain('context-promotion');
      expect(config).toContain('[permissions.ai-ops-safe-local.filesystem.":workspace_roots"]');
      expect(config).toContain('glob_scan_max_depth = 3');
      expect(config).toContain('"." = "write"');
      expect(config).toContain('".git" = "read"');
      expect(config).toContain('".codex" = "read"');
      expect(config).toContain('".codex/plans" = "write"');
      expect(config).toContain('"**/*.env" = "deny"');
      expect(config).not.toContain('[permissions.ai-ops-safe-local.filesystem.":project_roots"]');
      expect(config).not.toContain(' = "none"');
      expect(config).toContain('enabled = false');
      expect(config).not.toContain('sandbox_mode');
      expect(existsSync(resolveCodexRulesPath(paths.codexHomePath))).toBe(false);
      expect(existsSync(resolveCodexHooksPathForPermissions(paths.codexHomePath))).toBe(false);
    } finally {
      paths.cleanup();
    }
  });

  it('uses the docs permission syntax when the local Codex runtime validates it', () => {
    const paths = setup();
    try {
      const result = installCodexSafePermissions(paths, docsSyntaxOptions);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.conflict).toBe(null);
      expect(result.config.warning).toBe(null);
      expect(config).toContain('[permissions.ai-ops-safe-local.filesystem.":workspace_roots"]');
      expect(config).toContain('"**/*.env" = "deny"');
      expect(config).not.toContain('[permissions.ai-ops-safe-local.filesystem.":project_roots"]');
      expect(config).not.toContain('"**/*.env" = "none"');
    } finally {
      paths.cleanup();
    }
  });

  it('fails closed without writing config when no permission syntax validates', () => {
    const paths = setup();
    try {
      const result = installCodexSafePermissions(paths, {
        validateProfileCandidate: createSyntaxValidator(),
      });

      expect(result.config.installed).toBe(false);
      expect(result.config.changed).toBe(false);
      expect(result.config.conflict).toContain(CONFIG_CONFLICT_NO_VALID_PROFILE);
      expect(existsSync(resolveCodexConfigPath(paths.codexHomePath))).toBe(false);
    } finally {
      paths.cleanup();
    }
  });

  it('uses the documented workspace_roots syntax with a warning when Codex validation is unavailable', () => {
    const paths = setup();
    try {
      const result = installCodexSafePermissions(paths, {
        validateProfileCandidate: unavailableValidator,
      });
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.warning).toBe(CONFIG_WARNING_VALIDATOR_UNAVAILABLE);
      expect(config).toContain('[permissions.ai-ops-safe-local.filesystem.":workspace_roots"]');
      expect(config).toContain('"**/*.env" = "deny"');
      expect(config).not.toContain('[permissions.ai-ops-safe-local.filesystem.":project_roots"]');
      expect(config).not.toContain(' = "none"');
    } finally {
      paths.cleanup();
    }
  });

  it('keeps default_permissions top-level when config already has tables', () => {
    const paths = setup();
    try {
      mkdirSync(paths.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(paths.codexHomePath),
        [
          'model = "gpt-5.5"',
          '',
          '[profiles.safe-local]',
          `default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`,
          'model = "gpt-5.5"',
          '',
        ].join('\n'),
        'utf-8',
      );

      const result = installCodexSafePermissions(paths, docsSyntaxOptions);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.conflict).toBe(null);
      expect(result.config.changed).toBe(true);
      expect(config.indexOf('model = "gpt-5.5"')).toBeLessThan(
        config.indexOf(`default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`),
      );
      expect(config.indexOf(`default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`)).toBeLessThan(
        config.indexOf('[permissions.ai-ops-safe-local]'),
      );
      expect(config.indexOf('[permissions.ai-ops-safe-local.network]')).toBeLessThan(
        config.indexOf('[profiles.safe-local]'),
      );
    } finally {
      paths.cleanup();
    }
  });

  it('fails closed for user-owned sandbox settings and different default permissions', () => {
    const sandboxMode = setup();
    const sandboxWorkspace = setup();
    const otherProfile = setup();
    const matchingUserProfile = setup();
    try {
      mkdirSync(sandboxMode.codexHomePath, { recursive: true });
      writeFileSync(resolveCodexConfigPath(sandboxMode.codexHomePath), 'sandbox_mode = "workspace-write"\n', 'utf-8');
      expect(installCodexSafePermissions(sandboxMode, docsSyntaxOptions).config.conflict).toContain(
        'sandbox_mode',
      );

      mkdirSync(sandboxWorkspace.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(sandboxWorkspace.codexHomePath),
        ['[sandbox_workspace_write]', 'writable_roots = ["/tmp/example"]', ''].join('\n'),
        'utf-8',
      );
      expect(installCodexSafePermissions(sandboxWorkspace, docsSyntaxOptions).config.conflict).toContain(
        'sandbox_mode',
      );

      mkdirSync(otherProfile.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(otherProfile.codexHomePath),
        'default_permissions = "project-edit"\n',
        'utf-8',
      );
      expect(installCodexSafePermissions(otherProfile, docsSyntaxOptions).config.conflict).toContain(
        'default_permissions',
      );

      mkdirSync(matchingUserProfile.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(matchingUserProfile.codexHomePath),
        [
          `default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`,
          '',
          `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem]`,
          '":minimal" = "read"',
          '',
        ].join('\n'),
        'utf-8',
      );
      const matchingProfileResult = installCodexSafePermissions(matchingUserProfile, docsSyntaxOptions);
      expect(matchingProfileResult.config.conflict).toContain('permissions.ai-ops-safe-local');
      expect(readFileSync(resolveCodexConfigPath(matchingUserProfile.codexHomePath), 'utf-8')).not.toContain(
        'ai-ops:safe-permissions:profile',
      );
    } finally {
      sandboxMode.cleanup();
      sandboxWorkspace.cleanup();
      otherProfile.cleanup();
      matchingUserProfile.cleanup();
    }
  });

  it('migrates legacy ai-ops managed config, rules, and PermissionRequest hook to v2 profile config', () => {
    const paths = setup();
    try {
      writeLegacySafeLocalFiles(paths);
      const result = installCodexSafePermissions(paths, docsSyntaxOptions);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');
      const rules = readFileSync(resolveCodexRulesPath(paths.codexHomePath), 'utf-8');
      const hooks = readFileSync(resolveCodexHooksPathForPermissions(paths.codexHomePath), 'utf-8');

      expect(result.config.changed).toBe(true);
      expect(result.rules.changed).toBe(true);
      expect(result.hook.changed).toBe(true);
      expect(config).toContain(`default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`);
      expect(config).not.toContain('sandbox_mode');
      expect(config).not.toContain('[sandbox_workspace_write]');
      expect(config).not.toContain('ai-ops:safe-permissions:config');
      expect(rules).toContain('prefix_rule(pattern = ["keep"], decision = "prompt")');
      expect(rules).not.toContain('ai-ops:safe-permissions');
      expect(hooks).toContain('echo keep');
      expect(hooks).not.toContain('PermissionRequest');
      expect(hooks).not.toContain('codex-permissions hook permission-request safe-local');
    } finally {
      paths.cleanup();
    }
  });

  it('rewrites a managed project_roots profile to workspace_roots syntax', () => {
    const paths = setup();
    try {
      mkdirSync(paths.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(paths.codexHomePath),
        [
          PROFILE_BLOCK_START,
          `default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"`,
          '',
          `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}]`,
          '',
          `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem]`,
          'glob_scan_max_depth = 3',
          '":minimal" = "read"',
          `"${paths.personalContextRoot}" = "write"`,
          '',
          `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem.":project_roots"]`,
          '"." = "write"',
          '".git" = "read"',
          '".codex" = "read"',
          '".codex/plans" = "write"',
          '".env" = "none"',
          '',
          `[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.network]`,
          'enabled = false',
          PROFILE_BLOCK_END,
          '',
        ].join('\n'),
        'utf-8',
      );

      const result = installCodexSafePermissions(paths, docsSyntaxOptions);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.changed).toBe(true);
      expect(config).toContain(`[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}.filesystem.":workspace_roots"]`);
      expect(config).toContain('"**/*.env" = "deny"');
      expect(config).not.toContain(':project_roots');
      expect(config).not.toContain(' = "none"');
    } finally {
      paths.cleanup();
    }
  });

  it('uninstalls only ai-ops managed profile and legacy cleanup blocks', () => {
    const paths = setup();
    try {
      installCodexSafePermissions(paths, docsSyntaxOptions);
      const result = uninstallCodexSafePermissions(paths);
      const config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(result.config.changed).toBe(true);
      expect(config).not.toContain(SAFE_LOCAL_CODEX_PERMISSION_NAME);
      expect(config).not.toContain('ai-ops:safe-permissions');
    } finally {
      paths.cleanup();
    }
  });

  it('preserves a user-owned matching default_permissions on install and uninstall', () => {
    const paths = setup();
    try {
      mkdirSync(paths.codexHomePath, { recursive: true });
      writeFileSync(
        resolveCodexConfigPath(paths.codexHomePath),
        `default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"\n`,
        'utf-8',
      );

      installCodexSafePermissions(paths, docsSyntaxOptions);
      let config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');
      expect(config.match(/default_permissions/g)?.length).toBe(1);
      expect(config).toContain(`[permissions.${SAFE_LOCAL_CODEX_PERMISSION_NAME}]`);

      uninstallCodexSafePermissions(paths);
      config = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');
      expect(config).toBe(`default_permissions = "${SAFE_LOCAL_CODEX_PERMISSION_NAME}"\n`);
    } finally {
      paths.cleanup();
    }
  });

  it('reports status without mutating files', () => {
    const paths = setup();
    try {
      installCodexSafePermissions(paths, docsSyntaxOptions);
      const before = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');
      const status = inspectCodexSafePermissions(paths, docsSyntaxOptions);
      const after = readFileSync(resolveCodexConfigPath(paths.codexHomePath), 'utf-8');

      expect(status.config.installed).toBe(true);
      expect(status.rules.installed).toBe(true);
      expect(status.hook.installed).toBe(true);
      expect(after).toBe(before);
    } finally {
      paths.cleanup();
    }
  });

  it('treats trailing EOF blank lines as installed without rewriting config', () => {
    const paths = setup();
    try {
      installCodexSafePermissions(paths, docsSyntaxOptions);
      const configPath = resolveCodexConfigPath(paths.codexHomePath);
      const before = readFileSync(configPath, 'utf-8');
      writeFileSync(configPath, `${before}\n`, 'utf-8');
      const withExtraBlankLine = readFileSync(configPath, 'utf-8');

      const status = inspectCodexSafePermissions(paths, docsSyntaxOptions);
      const reinstall = installCodexSafePermissions(paths, docsSyntaxOptions);
      const after = readFileSync(configPath, 'utf-8');

      expect(status.config.installed).toBe(true);
      expect(reinstall.config.changed).toBe(false);
      expect(after).toBe(withExtraBlankLine);
    } finally {
      paths.cleanup();
    }
  });

  it('reports not installed when the managed profile content differs', () => {
    const paths = setup();
    try {
      installCodexSafePermissions(paths, docsSyntaxOptions);
      const configPath = resolveCodexConfigPath(paths.codexHomePath);
      const config = readFileSync(configPath, 'utf-8');
      expect(config).toContain('".git" = "read"');
      writeFileSync(configPath, config.replace('".git" = "read"', '".git" = "write"'), 'utf-8');

      const status = inspectCodexSafePermissions(paths, docsSyntaxOptions);

      expect(status.config.installed).toBe(false);
      expect(status.config.conflict).toBe(null);
    } finally {
      paths.cleanup();
    }
  });
});
