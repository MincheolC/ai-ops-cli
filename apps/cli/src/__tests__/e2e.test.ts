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
    raw.includes('[permissions.ai-ops-safe-local.filesystem.":project_roots"]') &&
    raw.includes('"**/*.env" = "none"');
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
      expect(raw).toContain('":project_roots"');
      expect(raw).toContain('Codex-compatible');
      expect(raw).toContain('installed Codex runtime');
      expect(raw).toContain('.codex/plans');
      expect(raw).toContain('.git');
      expect(raw).toContain('orchestrator');
    }
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

  it('doc-impact-reviewer installs only under global AI_OPS_HOME', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'doc-impact-reviewer', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...process.env, AI_OPS_HOME: userHome },
        },
      );

      expect(result.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/doc-impact-reviewer/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/doc-impact-reviewer/agents/openai.yaml'))).toBe(true);

      const registryRaw = readFileSync(join(userHome, '.ai-ops/skills-manifest.json'), 'utf-8');
      expect(registryRaw).toContain('"id": "doc-impact-reviewer"');
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

  it('context-promotion-review installs only under global AI_OPS_HOME', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    try {
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'skill', 'install', 'context-promotion-review', '--tool', 'codex'],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...process.env, AI_OPS_HOME: userHome },
        },
      );

      expect(result.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/context-promotion-review/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/context-promotion-review/agents/openai.yaml'))).toBe(true);

      const registryRaw = readFileSync(join(userHome, '.ai-ops/skills-manifest.json'), 'utf-8');
      expect(registryRaw).toContain('"id": "context-promotion-review"');
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

describe.skipIf(!distExists)('codex hook subprocess', () => {
  it('context-promotion install writes portable hook and installs the Codex skill under AI_OPS_HOME', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    try {
      const env = { ...process.env, AI_OPS_HOME: userHome, CODEX_HOME: codexHome };
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'codex-hook', 'install', 'context-promotion'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      const hooksRaw = readFileSync(join(codexHome, 'hooks.json'), 'utf-8');
      expect(hooksRaw).toContain('"command": "ai-ops context-promotion hook post-tool-use"');
      expect(hooksRaw).not.toContain(BIN_PATH);
      expect(hooksRaw).not.toContain(process.execPath);
      expect(existsSync(join(userHome, '.agents/skills/context-promotion-review/SKILL.md'))).toBe(true);
      expect(existsSync(join(userHome, '.agents/skills/context-promotion-review/agents/openai.yaml'))).toBe(true);
      expect(existsSync(join(dir, '.agents'))).toBe(false);
      expect(existsSync(join(dir, '.codex'))).toBe(false);

      const statusResult = spawnSync(process.execPath, [BIN_PATH, 'codex-hook', 'status', 'context-promotion'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(statusResult.status).toBe(0);
      expect(statusResult.stdout).toContain('hook installed: yes');
      expect(statusResult.stdout).toContain('skill installed: yes');
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('context-promotion install accepts a custom hook command', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    try {
      const customCommand = '/custom/bin/ai-ops context-promotion hook post-tool-use';
      const result = spawnSync(
        process.execPath,
        [BIN_PATH, 'codex-hook', 'install', 'context-promotion', '--command', customCommand],
        {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...process.env, AI_OPS_HOME: userHome, CODEX_HOME: codexHome },
        },
      );

      expect(result.status).toBe(0);
      expect(readFileSync(join(codexHome, 'hooks.json'), 'utf-8')).toContain(`"command": "${customCommand}"`);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
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
      expect(configRaw).toContain(`"${join(userHome, '.ai-ops/context-promotion')}" = "write"`);
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
        '"command": "ai-ops integration hook post-tool-use pc"',
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
      expect(readFileSync(join(codexHome, 'hooks.json'), 'utf-8')).not.toContain('integration hook post-tool-use pc');
      expect(existsSync(join(userHome, '.ai-ops/integrations-manifest.json'))).toBe(false);
    } finally {
      rmSync(userHome, { recursive: true, force: true });
      rmSync(codexHome, { recursive: true, force: true });
      cleanup();
    }
  });

  it('context-promotion integration wraps the existing skill and hook components', () => {
    const { dir, cleanup } = setup();
    const userHome = mkdtempSync(join(tmpdir(), 'ai-ops-home-'));
    const codexHome = mkdtempSync(join(tmpdir(), 'codex-home-'));
    const env = { ...process.env, AI_OPS_HOME: userHome, HOME: userHome, CODEX_HOME: codexHome };
    try {
      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'context-promotion'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(existsSync(join(userHome, '.agents/skills/context-promotion-review/SKILL.md'))).toBe(true);
      expect(readFileSync(join(codexHome, 'hooks.json'), 'utf-8')).toContain(
        '"command": "ai-ops context-promotion hook post-tool-use"',
      );
      expect(readFileSync(join(userHome, '.ai-ops/integrations-manifest.json'), 'utf-8')).toContain(
        '"id": "context-promotion"',
      );

      const listResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'list'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });
      expect(listResult.status).toBe(0);
      expect(listResult.stdout).toContain('context-promotion - installed');
      expect(listResult.stdout).toContain('pc - not installed');
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
      mkdirSync(join(userHome, '.agents/skills/context-promotion-review'), { recursive: true });
      mkdirSync(join(userHome, '.ai-ops'), { recursive: true });
      writeFileSync(join(userHome, '.agents/skills/context-promotion-review/SKILL.md'), 'stale skill\n', 'utf-8');
      writeFileSync(
        join(userHome, '.ai-ops/skills-manifest.json'),
        JSON.stringify(
          {
            skills: [
              {
                id: 'context-promotion-review',
                kind: 'task',
                tools: ['codex'],
                installed_paths: ['.agents/skills/context-promotion-review'],
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

      const installResult = spawnSync(process.execPath, [BIN_PATH, 'integration', 'install', 'context-promotion'], {
        cwd: dir,
        encoding: 'utf-8',
        env,
      });

      expect(installResult.status).toBe(0);
      expect(readFileSync(join(userHome, '.agents/skills/context-promotion-review/SKILL.md'), 'utf-8')).toContain(
        'context-promotion-review',
      );
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
