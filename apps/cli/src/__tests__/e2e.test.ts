import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolveManifestPath } from '@/core/index.js';

const BIN_PATH = new URL('../../dist/bin/index.js', import.meta.url).pathname;

// dist/ 빌드가 없어도 compiler API 통합 테스트는 실행 가능
// subprocess 테스트는 dist 존재 시에만 실행
const distExists = existsSync(BIN_PATH);

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

// ─────────────────────────────────────────────────────────────
// subprocess: --version / --help (dist 빌드 필요)
// ─────────────────────────────────────────────────────────────
describe.skipIf(!distExists)('bin subprocess', () => {
  it('--version returns 0.1.0', () => {
    const output = execFileSync(process.execPath, [BIN_PATH, '--version'], { encoding: 'utf-8' });
    expect(output.trim()).toBe('0.1.0');
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
      expect(existsSync(resolveManifestPath(dir))).toBe(false);
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
      expect(existsSync(resolveManifestPath(dir))).toBe(false);
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
      expect(result.stderr).toContain('AI_OPS_HOME or HOME is required for global asset commands');
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
