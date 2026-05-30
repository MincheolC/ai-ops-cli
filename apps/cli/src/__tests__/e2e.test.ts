import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const BIN_PATH = new URL('../../dist/bin/index.js', import.meta.url).pathname;
const PACKAGE_JSON_PATH = new URL('../../package.json', import.meta.url).pathname;
const ROOT_README_PATH = new URL('../../../../README.md', import.meta.url).pathname;
const ROOT_README_KO_PATH = new URL('../../../../README.ko.md', import.meta.url).pathname;
const CLI_README_PATH = new URL('../../README.md', import.meta.url).pathname;
const CLI_README_KO_PATH = new URL('../../README.ko.md', import.meta.url).pathname;
const STUDIO_PLATFORM_PACKAGE_JSON_PATH = new URL('../../../studio-darwin-arm64/package.json', import.meta.url)
  .pathname;

// dist/ 빌드가 없어도 compiler API 통합 테스트는 실행 가능
// subprocess 테스트는 dist 존재 시에만 실행
const distExists = existsSync(BIN_PATH);

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

const hasCodexPermissionEnvRule = (raw: string): boolean => {
  const hasDocsSyntax =
    raw.includes('[permissions.ai-ops-safe-local.filesystem.":workspace_roots"]') &&
    raw.includes('"**/*.env" = "deny"');
  const hasExactCompatibilitySyntax =
    raw.includes('[permissions.ai-ops-safe-local.filesystem.":project_roots"]') &&
    raw.includes('".env" = "none"') &&
    raw.includes('".env.local" = "none"') &&
    !raw.includes('"**/*.env" = "none"');
  const hasLegacyCompatibilitySyntax =
    raw.includes('[permissions.ai-ops-safe-local.filesystem.":project_roots"]') && raw.includes('"**/*.env" = "none"');
  return hasDocsSyntax || hasExactCompatibilitySyntax || hasLegacyCompatibilitySyntax;
};

const readSpawnErrorCode = (error: unknown): string | null => {
  if (!(error instanceof Error) || !('code' in error)) {
    return null;
  }
  const code = error.code;
  return typeof code === 'string' ? code : null;
};

describe('documentation contracts', () => {
  it('documents the run-scoped codex exec worker guidance', () => {
    for (const readmePath of [ROOT_README_PATH, ROOT_README_KO_PATH, CLI_README_PATH, CLI_README_KO_PATH]) {
      const raw = readFileSync(readmePath, 'utf-8');
      expect(raw).toContain('codex exec --ignore-user-config --ignore-rules --cd "$WORKTREE"');
      expect(raw).toContain('approval_policy="never"');
      expect(raw).toContain('default_permissions=":read-only"');
      expect(raw).toContain('default_permissions="ai-worker-impl"');
      expect(raw).toContain('":workspace_roots"');
      expect(raw).toContain('"**/*.env"="deny"');
      expect(raw).toContain('glob_scan_max_depth');
      expect(raw).toContain('Codex permission syntax');
      expect(raw).toContain('installed Codex runtime');
      expect(raw).toContain('.codex/plans');
      expect(raw).toContain('.codex');
      expect(raw).toContain('.git');
      expect(raw).toContain('orchestrator');
    }
  });
});

describe('studio package contracts', () => {
  it('declares the macOS arm64 Studio package as an optional CLI dependency', () => {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as {
      optionalDependencies?: Record<string, string>;
      version: string;
    };

    expect(packageJson.optionalDependencies).toMatchObject({
      'ai-ops-studio-darwin-arm64': packageJson.version,
    });
  });

  it('packages the Studio macOS arm64 binary from a platform-specific workspace', () => {
    const packageJson = JSON.parse(readFileSync(STUDIO_PLATFORM_PACKAGE_JSON_PATH, 'utf-8')) as {
      name: string;
      version: string;
      os: string[];
      cpu: string[];
      files: string[];
      bin: Record<string, string>;
    };

    expect(packageJson).toMatchObject({
      name: 'ai-ops-studio-darwin-arm64',
      os: ['darwin'],
      cpu: ['arm64'],
      files: expect.arrayContaining(['bin']),
      bin: {
        'ai-ops-studio': './bin/ai-ops-studio',
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// subprocess: --version / --help (dist 빌드 필요)
// ─────────────────────────────────────────────────────────────
describe.skipIf(!distExists)('bin subprocess', () => {
  it('--version returns package version', () => {
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf-8')) as { version: string };
    const output = execFileSync(process.execPath, [BIN_PATH, '--version'], { encoding: 'utf-8' });
    expect(output.trim()).toBe(packageJson.version);
  });

  it('--help contains command names', () => {
    const output = execFileSync(process.execPath, [BIN_PATH, '--help'], { encoding: 'utf-8' });
    expect(output).toContain('init');
    expect(output).toContain('update');
    expect(output).toContain('diff');
    expect(output).toContain('uninstall');
    expect(output).not.toContain('--scope');
  });

  it('--scope remains unsupported on top-level init', () => {
    const result = spawnSync(process.execPath, [BIN_PATH, 'init', '--scope', 'global'], {
      encoding: 'utf-8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("error: unknown option '--scope'");
  });
});

describe.skipIf(!distExists)('skill subprocess', () => {
  it('skill install help only exposes --tool', () => {
    const output = execFileSync(process.execPath, [BIN_PATH, 'skill', 'install', '--help'], { encoding: 'utf-8' });

    expect(output).toContain('--tool');
    expect(output).not.toContain('--project');
    expect(output).not.toContain('--global');
    expect(output).not.toContain('--scope');
  });

  it('project scope skill install option is rejected', () => {
    const { dir, cleanup } = setup();
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'skill-load-check', '--project', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("error: unknown option '--project'");
      expect(existsSync(join(dir, '.agents/skills/skill-load-check/SKILL.md'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops/manifest.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('skill install writes global registry under AI_OPS_HOME without touching cwd', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'skill-load-check', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...process.env, AI_OPS_HOME: userHome },
        },
      );

      expect(result.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/skill-load-check/SKILL.md'))).toBe(true);

      const registryRaw = readFileSync(join(userHome, '.ai-ops/skills-manifest.json'), 'utf-8');
      expect(registryRaw).toContain('"id": "skill-load-check"');
      expect(registryRaw).not.toContain('"scope"');
      expect(existsSync(join(dir, '.agents/skills'))).toBe(false);
      expect(existsSync(join(dir, '.claude/skills'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops/manifest.json'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('ai-ops-project-owned-docs installs only under global AI_OPS_HOME', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'ai-ops-project-owned-docs', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...process.env, AI_OPS_HOME: userHome },
        },
      );

      expect(result.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/ai-ops-project-owned-docs/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/ai-ops-project-owned-docs/agents/openai.yaml'))).toBe(true);

      const registryRaw = readFileSync(join(userHome, '.ai-ops/skills-manifest.json'), 'utf-8');
      expect(registryRaw).toContain('"id": "ai-ops-project-owned-docs"');
      expect(existsSync(join(dir, '.agents'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);
      expect(existsSync(join(dir, '.codex'))).toBe(false);
      expect(existsSync(join(dir, '.claude'))).toBe(false);
      expect(existsSync(join(dir, '.gemini'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });
});

describe.skipIf(!distExists)('codex permissions subprocess', () => {
  it('safe-local install/status/uninstall manages Codex permission profile and legacy cleanup', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome, HOME: home, CODEX_HOME: codexHome };
    try {
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'codex-permissions', 'install', 'safe-local'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      const reinstallResult = spawnSync(process.execPath, [BIN_PATH, 'codex-permissions', 'install', 'safe-local'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'codex-permissions', 'status', 'safe-local'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(reinstallResult.status).toBe(0);
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('config: installed');
      expect(statusResult.stdout).toContain('rules: installed');
      expect(statusResult.stdout).toContain('hook: installed');

      const configRaw = readFileSync(join(codexHome, 'config.toml'), 'utf-8');
      expect(configRaw).toContain('default_permissions = "ai-ops-safe-local"');
      expect(configRaw).toContain('[permissions.ai-ops-safe-local]');
      expect(configRaw).toContain(`"${join(home, '.personal-project-contexts')}" = "write"`);
      expect(configRaw).not.toContain('context-promotion');
      expect(configRaw).toContain('glob_scan_max_depth = 3');
      expect(configRaw).toContain('".codex/plans" = "write"');
      expect(configRaw).toContain('".git" = "read"');
      expect(hasCodexPermissionEnvRule(configRaw)).toBe(true);
      expect(configRaw).not.toContain('sandbox_mode');
      expect(existsSync(join(codexHome, 'rules/default.rules'))).toBe(false);
      expect(existsSync(join(codexHome, 'hooks.json'))).toBe(false);

      const codexValidationResult = spawnSync(
        'codex',
        ['--enable', 'exec_permission_approvals', 'debug', 'prompt-input'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env,
          stdio: ['ignore', 'ignore', 'pipe'],
          timeout: 5000,
        },
      );
      if (codexValidationResult.error) {
        expect(readSpawnErrorCode(codexValidationResult.error)).toBe('ENOENT');
      } else {
        expect(codexValidationResult.stderr).not.toContain('failed to load configuration');
        expect(codexValidationResult.status).toBe(0);
      }

      const uninstallResult = spawnSync(process.execPath, [BIN_PATH, 'codex-permissions', 'uninstall', 'safe-local'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(uninstallResult.status).toBe(0);
      expect(readFileSync(join(codexHome, 'config.toml'), 'utf-8')).not.toContain('ai-ops-safe-local');
      expect(existsSync(join(dir, '.codex'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('deprecated safe-local permission-request hook remains a no-op compatibility command', () => {
    const { dir, cleanup } = setup();
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    try {
      const env = { ...process.env, HOME: home };
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'codex-permissions', 'hook', 'permission-request', 'safe-local'],
        {
          cwd: dir,
          encoding: 'utf-8',
          input: JSON.stringify({
            hook_event_name: 'PermissionRequest',
            cwd: dir,
            tool_name: 'Bash',
            tool_input: { command: 'git commit -m product-work' },
          }),
          env,
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('');
    } finally {
      rmSync(home, { recursive: true, force: true });
      cleanup();
    }
  });

  it('safe-local install exits non-zero when user-owned sandbox config conflicts', () => {
    const { dir, cleanup } = setup();
    const home = mkdtempSync(join(tmpdir(), 'home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const env = { ...process.env, HOME: home, CODEX_HOME: codexHome };
    try {
      writeFileSync(join(codexHome, 'config.toml'), 'sandbox_mode = "workspace-write"\n', 'utf-8');
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'codex-permissions', 'install', 'safe-local'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(1);
      expect(installResult.stdout).toContain('config: not installed');
      expect(installResult.stdout).toContain('conflict: sandbox_mode/sandbox_workspace_write is active');
      expect(readFileSync(join(codexHome, 'config.toml'), 'utf-8')).toBe('sandbox_mode = "workspace-write"\n');
    } finally {
      rmSync(home, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });
});

describe.skipIf(!distExists)('subagent subprocess', () => {
  it('subagent install help only exposes --tool', () => {
    const output = execFileSync(process.execPath, [BIN_PATH, 'subagent', 'install', '--help'], { encoding: 'utf-8' });

    expect(output).toContain('--tool');
    expect(output).not.toContain('--project');
    expect(output).not.toContain('--global');
    expect(output).not.toContain('--scope');
  });

  it('subagent install/diff/update/uninstall uses global manifest without touching cwd', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome };
    try {
      const installResult = spawnSync(
        process.execPath,
        [BIN_PATH, 'subagent', 'install', 'security-gate', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env,
        },
      );

      expect(installResult.status).toBe(0);
      expect(existsSync(join(userHome, '.codex/agents/security-gate.toml'))).toBe(true);
      expect(existsSync(join(userHome, '.claude/agents/security-gate.md'))).toBe(false);
      expect(existsSync(join(userHome, '.gemini/agents/security-gate.md'))).toBe(false);

      const manifestRaw = readFileSync(join(userHome, '.ai-ops/subagents-manifest.json'), 'utf-8');
      expect(manifestRaw).toContain('"id": "security-gate"');
      expect(manifestRaw).toContain('".codex/agents/security-gate.toml"');
      expect(existsSync(join(userHome, '.ai-ops/skills-manifest.json'))).toBe(false);
      expect(existsSync(join(dir, '.codex'))).toBe(false);
      expect(existsSync(join(dir, '.claude'))).toBe(false);
      expect(existsSync(join(dir, '.gemini'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);

      const diffResult = spawnSync(process.execPath, [BIN_PATH, 'subagent', 'diff', 'security-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(diffResult.status).toBe(0);
      expect(diffResult.stdout).toContain('up-to-date');

      const updateResult = spawnSync(process.execPath, [BIN_PATH, 'subagent', 'update', 'security-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(updateResult.status).toBe(0);
      expect(existsSync(join(userHome, '.codex/agents/security-gate.toml'))).toBe(true);

      const uninstallResult = spawnSync(process.execPath, [BIN_PATH, 'subagent', 'uninstall', 'security-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(uninstallResult.status).toBe(0);
      expect(existsSync(join(userHome, '.codex/agents/security-gate.toml'))).toBe(false);
      expect(existsSync(join(userHome, '.ai-ops/subagents-manifest.json'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('AI_OPS_HOME/HOME이 없으면 cwd에 global files를 만들지 않고 실패한다', () => {
    const { dir, cleanup } = setup();
    const { AI_OPS_HOME: _aiOpsHome, HOME: _home, ...envWithoutHome } = process.env;
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'subagent', 'install', 'security-gate', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: envWithoutHome,
        },
      );

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('AI_OPS_HOME or HOME is required for user/global component commands');
      expect(existsSync(join(dir, '.codex'))).toBe(false);
      expect(existsSync(join(dir, '.claude'))).toBe(false);
      expect(existsSync(join(dir, '.gemini'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('손상된 subagent manifest의 installed_paths로 AI_OPS_HOME 밖 파일을 삭제하지 않는다', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const outsideName = `${basename(userHome)}-outside.txt`;
    const outsidePath = join(userHome, '..', outsideName);
    try {
      mkdirSync(join(userHome, '.ai-ops'), { recursive: true });
      writeFileSync(outsidePath, 'keep', 'utf-8');
      writeFileSync(
        join(userHome, '.ai-ops/subagents-manifest.json'),
        JSON.stringify(
          {
            subagents: [
              {
                id: 'security-gate',
                tools: ['codex'],
                installed_paths: [`../${outsideName}`],
                sourceHash: 'a1b2c3',
              },
            ],
            generatedAt: '2026-05-15T00:00:00.000Z',
          },
          null,
          2,
        ),
        'utf-8',
      );

      const result = spawnSync(process.execPath, [BIN_PATH, 'subagent', 'uninstall', 'security-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env: { ...process.env, AI_OPS_HOME: userHome },
      });

      expect(result.status).not.toBe(0);
      expect(existsSync(outsidePath)).toBe(true);
    } finally {
      rmSync(outsidePath, { force: true });
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });
});

describe.skipIf(!distExists)('integration subprocess', () => {
  it('code-review-gate install/status/diff/update/uninstall is hookless and Codex-only', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome };
    delete env.HOME;
    delete env.CODEX_HOME;
    try {
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(installResult.stdout).toContain('integration 설치 완료: code-review-gate');
      expect(installResult.stdout).not.toContain('hook trust');
      expect(existsSync(join(userHome, '.agents/skills/code-review-scope-map/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/code-review-final-gate/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.codex/agents/code-review-gate.toml'))).toBe(true);
      expect(existsSync(join(userHome, '.codex/hooks.json'))).toBe(false);
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).toContain(
        '"id": "code-review-gate"',
      );
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).toContain(
        '"type": "subagent"',
      );
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).not.toContain(
        '"type": "codex-hook"',
      );
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).not.toContain(
        '"type": "receipt-config"',
      );
      expect(existsSync(join(dir, '.agents'))).toBe(false);
      expect(existsSync(join(dir, '.codex'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);

      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'status', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('integration installed: yes');
      expect(statusResult.stdout).toContain('skill installed: yes');
      expect(statusResult.stdout).toContain('subagent installed: yes');
      expect(statusResult.stdout).toContain('hook installed: n/a');
      expect(statusResult.stdout).toContain('hooks file: n/a');

      const diffResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'diff', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(diffResult.status).toBe(0);
      expect(diffResult.stdout).toContain('skill:code-review-scope-map: up-to-date');
      expect(diffResult.stdout).toContain('subagent:code-review-gate: up-to-date');

      const updateResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'update', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(updateResult.status).toBe(0);
      expect(existsSync(join(userHome, '.codex/agents/code-review-gate.toml'))).toBe(true);
      expect(existsSync(join(userHome, '.codex/hooks.json'))).toBe(false);

      const uninstallResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'uninstall', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(uninstallResult.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/code-review-scope-map/SKILL.md'))).toBe(false);
      expect(existsSync(join(userHome, '.codex/agents/code-review-gate.toml'))).toBe(false);
      expect(existsSync(join(userHome, '.ai-ops/integrations-manifest.json'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('code-review-gate update preserves pre-existing stale skills and status reports installed state only', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome };
    delete env.HOME;
    delete env.CODEX_HOME;
    const integrationManifestPath = join(userHome, '.ai-ops/integrations-manifest.json');
    const skillManifestPath = join(userHome, '.ai-ops/skills-manifest.json');
    const scopeMapSkillPath = join(userHome, '.agents/skills/code-review-scope-map/SKILL.md');
    type IntegrationManifestForTest = {
      integrations: {
        id: string;
        components: { type: string; id: string; owned: boolean }[];
      }[];
    };
    type SkillManifestForTest = {
      skills: { id: string; sourceHash: string }[];
      cliVersion?: string;
      generatedAt: string;
    };
    const readScopeMapIntegrationComponent = (): { type: string; id: string; owned: boolean } | undefined => {
      const manifest = JSON.parse(readFileSync(integrationManifestPath, 'utf-8')) as IntegrationManifestForTest;
      return manifest.integrations
        .find((integration) => integration.id === 'code-review-gate')
        ?.components.find((component) => component.type === 'skill' && component.id === 'code-review-scope-map');
    };
    try {
      const skillInstallResult = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'code-review-scope-map', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env,
        },
      );
      expect(skillInstallResult.status).toBe(0);

      const integrationInstallResult = spawnSync(
        process.execPath,
        [BIN_PATH, 'integration', 'install', 'code-review-gate'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env,
        },
      );
      expect(integrationInstallResult.status).toBe(0);
      expect(readScopeMapIntegrationComponent()?.owned).toBe(false);

      writeFileSync(scopeMapSkillPath, 'manual stale skill\n', 'utf-8');
      const skillManifest = JSON.parse(readFileSync(skillManifestPath, 'utf-8')) as SkillManifestForTest;
      writeFileSync(
        skillManifestPath,
        JSON.stringify(
          {
            ...skillManifest,
            skills: skillManifest.skills.map((skill) =>
              skill.id === 'code-review-scope-map' ? { ...skill, sourceHash: '000000' } : skill,
            ),
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'status', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('skill installed: yes');
      expect(statusResult.stdout).toContain('skill:code-review-scope-map installed: yes');

      const diffResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'diff', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(diffResult.status).toBe(0);
      expect(diffResult.stdout).toContain('skill:code-review-scope-map: changed');

      const updateResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'update', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(updateResult.status).toBe(0);
      expect(readScopeMapIntegrationComponent()?.owned).toBe(false);
      expect(readFileSync(scopeMapSkillPath, 'utf-8')).toBe('manual stale skill\n');

      const uninstallResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'uninstall', 'code-review-gate'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(uninstallResult.status).toBe(0);
      expect(existsSync(scopeMapSkillPath)).toBe(true);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('pc install/status/uninstall manages the skill, Codex hook, and integration manifest', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome, HOME: userHome, CODEX_HOME: codexHome };
    try {
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/pc/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/pc/agents/openai.yaml'))).toBe(true);
      expect(readFileSync(join(codexHome, 'hooks.json'), 'utf-8')).toContain(
        '"command": "ai-ops integration hook post-tool-use --workflows pc"',
      );
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).toContain('"id": "pc"');
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).toContain(
        '"type": "receipt-config"',
      );
      expect(existsSync(join(dir, '.agents'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);

      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'status', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('integration installed: yes');
      expect(statusResult.stdout).toContain('skill installed: yes');
      expect(statusResult.stdout).toContain('hook installed: yes');
      expect(statusResult.stdout).toContain('hook trust: configured; review and trust');
      expect(statusResult.stdout).toContain('pc context ready: no');
      expect(statusResult.stdout).toContain('receipt-config:personal-project-contexts (pre-existing)');

      const reinstallResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(reinstallResult.status).toBe(0);

      const uninstallResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'uninstall', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(uninstallResult.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/pc/SKILL.md'))).toBe(false);
      expect(readFileSync(join(codexHome, 'hooks.json'), 'utf-8')).not.toContain('integration hook post-tool-use');
      expect(existsSync(join(userHome, '.ai-ops/integrations-manifest.json'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('ignores and cleans removed context-promotion manifest entries on integration commands', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const manifestPath = join(userHome, '.ai-ops/integrations-manifest.json');
    const env = { ...process.env, AI_OPS_HOME: userHome, HOME: userHome, CODEX_HOME: codexHome };
    try {
      mkdirSync(join(userHome, '.ai-ops'), { recursive: true });
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: 'ai-ops-integrations-manifest',
            integrations: [
              {
                id: 'context-promotion',
                components: [],
                installedAt: '2026-05-19T00:00:00.000Z',
                updatedAt: '2026-05-19T00:00:00.000Z',
              },
            ],
            cliVersion: '1.2.3',
            generatedAt: '2026-05-19T00:00:00.000Z',
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const listResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'list'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(listResult.status).toBe(0);
      expect(listResult.stdout).toContain('pc - ○ not installed');
      expect(listResult.stdout).not.toContain('context-promotion');

      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(installResult.status).toBe(0);
      expect(readFileSync(manifestPath, 'utf-8')).toContain('"id": "pc"');
      expect(readFileSync(manifestPath, 'utf-8')).not.toContain('context-promotion');
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('integration install refreshes stale pre-existing skill sources', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome, HOME: userHome, CODEX_HOME: codexHome };
    try {
      mkdirSync(join(userHome, '.agents/skills/pc'), { recursive: true });
      mkdirSync(join(userHome, '.ai-ops'), { recursive: true });
      writeFileSync(join(userHome, '.agents/skills/pc/SKILL.md'), 'stale skill\n', 'utf-8');
      writeFileSync(
        join(userHome, '.ai-ops/skills-manifest.json'),
        JSON.stringify(
          {
            skills: [
              {
                id: 'pc',
                kind: 'task',
                tools: ['codex'],
                installed_paths: ['.agents/skills/pc'],
                sourceHash: '000000',
              },
            ],
            cliVersion: '0.0.0',
            generatedAt: '2026-05-19T00:00:00.000Z',
          },
          null,
          2,
        ),
        'utf-8',
      );

      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'pc'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(readFileSync(join(userHome, '.agents/skills/pc/SKILL.md'), 'utf-8')).toContain('pc');
      expect(readFileSync(join(userHome, '.ai-ops/skills-manifest.json'), 'utf-8')).not.toContain(
        '"sourceHash": "000000"',
      );
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });
});

describe.skipIf(!distExists)('pc subprocess', () => {
  const setupGitRepo = (): { dir: string; cleanup: () => void } => {
    const { dir, cleanup } = setup();
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
    writeFileSync(join(dir, 'tracked.txt'), 'initial\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: dir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
    return { dir, cleanup };
  };

  const writePcContext = (params: { contextRoot: string; workspaceRoot: string }): void => {
    const workspaceDir = join(params.contextRoot, 'workspaces/demo-workspace');
    mkdirSync(join(workspaceDir, 'repos'), { recursive: true });
    mkdirSync(join(workspaceDir, 'workstreams'), { recursive: true });
    mkdirSync(join(params.contextRoot, 'daily'), { recursive: true });
    writeFileSync(
      join(workspaceDir, 'workspace-state.md'),
      [
        '# Demo Workspace',
        '',
        '## 식별',
        '',
        '- 워크스페이스 ID: demo-workspace',
        `- 워크스페이스 루트: ${params.workspaceRoot}`,
        '- 마지막 갱신일: 2026-05-27',
        '',
        '## 활성 Workstream',
        '',
        '- ID: demo-work',
        '- 제목: Demo work',
        '',
        '## 마지막 Handoff',
        '',
        '- 날짜: 2026-05-27',
        '- 요약: 이전 handoff',
        '- 다음 첫 행동: 이전 행동',
        '',
        '## 장기 결정',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(workspaceDir, 'repos/demo-repo.md'),
      [
        '# Demo Repo',
        '',
        '## 식별',
        '',
        '- 엔트리 ID: demo-repo',
        `- 경로: ${params.workspaceRoot}`,
        '',
        '## 버전 관리',
        '',
        '- 버전 관리: git',
        `- Git 루트: ${params.workspaceRoot}`,
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(workspaceDir, 'workstreams/demo-work.md'),
      [
        '# Demo Work',
        '',
        '## 식별',
        '',
        '- ID: demo-work',
        '- 상태: Active',
        '- 마지막 갱신일: 2026-05-27',
        '',
        '## 범위',
        '',
        '- 워크스페이스: demo-workspace',
        '- 엔트리:',
        '  - demo-repo',
        '',
        '## 다음 첫 행동',
        '',
        '이전 행동',
        '',
        '## 마지막 확인 Commit',
        '',
        '- `demo-repo`: none',
        '',
        '## Handoff',
        '',
      ].join('\n'),
      'utf-8',
    );
    writeFileSync(
      join(workspaceDir, 'backlog.md'),
      [
        '# Workstream Index',
        '',
        '## 진행중',
        '',
        '- [ ] `demo-work` Demo work',
        '  - 상태: Active',
        '  - 범위: demo-repo',
        '  - 파일: workstreams/demo-work.md',
        '  - 다음 첫 행동: 이전 행동',
        '',
      ].join('\n'),
      'utf-8',
    );
  };

  it('runs pc done draft -> filled JSON -> apply through the built CLI', () => {
    const product = setupGitRepo();
    const userHome = mkdtempSync(join(tmpdir(), 'pc-home-'));
    const contextRoot = join(userHome, '.personal-project-contexts');
    const env = { ...process.env, HOME: userHome, AI_OPS_HOME: userHome };
    try {
      mkdirSync(contextRoot, { recursive: true });
      execFileSync('git', ['init'], { cwd: contextRoot, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: contextRoot });
      execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: contextRoot });
      writePcContext({ contextRoot, workspaceRoot: product.dir });
      execFileSync('git', ['add', '.'], { cwd: contextRoot });
      execFileSync('git', ['commit', '-m', 'init context'], { cwd: contextRoot, stdio: 'ignore' });

      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'pc', 'status'], {
        cwd: product.dir,
        encoding: 'utf-8',
        env,
      });
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('pc context ready: yes');

      const draftResult = spawnSync(process.execPath, [BIN_PATH, 'pc', 'done', 'draft', '--cwd', product.dir], {
        cwd: product.dir,
        encoding: 'utf-8',
        env,
      });
      expect(draftResult.status).toBe(0);
      const draftPath = /draft created:\s+(\S+pc-done-\S+\.json)/u.exec(draftResult.stdout)?.[1];
      expect(draftPath).toBeTruthy();
      const parsedDraft = JSON.parse(readFileSync(draftPath ?? '', 'utf-8')) as Record<string, unknown>;
      writeFileSync(
        draftPath ?? '',
        JSON.stringify(
          {
            ...parsedDraft,
            completed: ['CLI draft/apply e2e 확인'],
            verification: ['ai-ops pc status'],
            remaining: ['실사용 hook smoke'],
            nextAction: '실제 hook에서 draft/apply를 한 번 더 확인한다.',
            nextActionEvidence: 'pc status가 ready이고 product HEAD가 draft와 일치한다.',
            blockers: [],
            durableContextDelta: null,
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const applyResult = spawnSync(process.execPath, [BIN_PATH, 'pc', 'done', 'apply', '--draft', draftPath ?? ''], {
        cwd: product.dir,
        encoding: 'utf-8',
        env,
      });
      expect(applyResult.status).toBe(0);
      expect(applyResult.stdout).toContain('context commit created');
      expect(readFileSync(join(contextRoot, 'workspaces/demo-workspace/workstreams/demo-work.md'), 'utf-8')).toContain(
        'CLI draft/apply e2e 확인',
      );
      expect(execFileSync('git', ['status', '--short'], { cwd: product.dir, encoding: 'utf-8' }).trim()).toBe('');

      const contextHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: contextRoot, encoding: 'utf-8' }).trim();
      const secondApply = spawnSync(process.execPath, [BIN_PATH, 'pc', 'done', 'apply', '--draft', draftPath ?? ''], {
        cwd: product.dir,
        encoding: 'utf-8',
        env,
      });
      expect(secondApply.status).toBe(0);
      expect(secondApply.stdout).toContain('변경 없음');
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: contextRoot, encoding: 'utf-8' }).trim()).toBe(
        contextHead,
      );
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      product.cleanup();
    }
  });
});
