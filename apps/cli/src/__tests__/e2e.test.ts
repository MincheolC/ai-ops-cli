import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  loadAllRules,
  loadPresets,
  resolvePresetRules,
  renderForTool,
  buildInstallPlan,
  buildManifest,
  writeManifest,
  readManifest,
  resolveManifestPath,
  computeSourceHash,
  computeDiff,
  hasAiOpsSection,
} from '@/core/index.js';
import { installFiles } from '../lib/install.js';
import { removeFiles } from '../lib/uninstall.js';
import { resolveCompilerDataDir, resolveRulesDir, resolvePresetsPath } from '../lib/paths.js';

const BIN_PATH = new URL('../../dist/bin/index.js', import.meta.url).pathname;
const compilerDataDir = resolveCompilerDataDir();

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

// ─────────────────────────────────────────────────────────────
// 통합 E2E: compiler API 직접 호출 (TUI 우회)
// ─────────────────────────────────────────────────────────────
describe('E2E: single-project install flow', () => {
  const rulesDir = resolveRulesDir();
  const presetsPath = resolvePresetsPath();

  let allRules: ReturnType<typeof loadAllRules>;

  beforeAll(() => {
    allRules = loadAllRules(rulesDir);
  });

  it('loadAllRules returns non-empty array', () => {
    expect(allRules.length).toBeGreaterThan(0);
  });

  it('loadPresets returns non-empty array', () => {
    const presets = loadPresets(presetsPath);
    expect(presets.length).toBeGreaterThan(0);
  });

  it('full install: renders and writes files, builds manifest', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(compilerDataDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      // claude-code
      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const result = installFiles(dir, actions, meta);

      expect(result.written.length).toBeGreaterThan(0);
      expect(result.appended).toHaveLength(0);

      // 파일 존재 + managed header 검증
      for (const rel of result.written) {
        const absPath = join(dir, rel);
        expect(existsSync(absPath)).toBe(true);
        const content = readFileSync(absPath, 'utf-8');
        expect(hasAiOpsSection(content)).toBe(true);
      }

      // manifest 저장 + 재로드
      const manifest = buildManifest({
        tools: ['claude-code'],
        scope: 'project',
        preset: preset.id,
        installedRules: rules.map((r) => r.id),
        sourceHash,
      });
      const manifestPath = resolveManifestPath(dir);
      writeManifest(manifestPath, manifest);

      const loaded = readManifest(manifestPath);
      expect(loaded).not.toBeNull();
      expect(loaded?.installed_rules).toEqual(manifest.installed_rules);
      expect(loaded?.sourceHash).toBe(sourceHash);
      expect(loaded?.tools).toContain('claude-code');
    } finally {
      cleanup();
    }
  });

  it('idempotency: 동일 인자로 2회 설치 → 파일 내용 동일', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(compilerDataDir);
      const meta = { sourceHash, generatedAt: '2026-01-01T00:00:00.000Z' };

      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });

      installFiles(dir, actions, meta);
      const firstContents = actions.map((a) => readFileSync(join(dir, a.relativePath), 'utf-8'));

      // 2nd install (same meta → content identical)
      installFiles(dir, actions, meta);
      const secondContents = actions.map((a) => readFileSync(join(dir, a.relativePath), 'utf-8'));

      expect(firstContents).toEqual(secondContents);
    } finally {
      cleanup();
    }
  });

  it('non-managed 파일 → append (사용자 내용 보존 + 섹션 추가)', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(compilerDataDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const firstAction = actions[0];

      // 사용자가 직접 작성한 파일
      const absPath = join(dir, firstAction.relativePath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, '# User content (not managed)', 'utf-8');

      const result = installFiles(dir, [firstAction], meta);
      expect(result.appended).toContain(firstAction.relativePath);
      expect(result.written).not.toContain(firstAction.relativePath);
      expect(result.skipped).toHaveLength(0);

      // 사용자 내용 보존 + 섹션 마커 포함 확인
      const content = readFileSync(absPath, 'utf-8');
      expect(content).toContain('# User content (not managed)');
      expect(content).toContain('<!-- ai-ops:start -->');
      expect(content).toContain('<!-- ai-ops:end -->');
    } finally {
      cleanup();
    }
  });
});

describe('E2E: update flow', () => {
  const rulesDir = resolveRulesDir();
  const presetsPath = resolvePresetsPath();

  it('computeDiff detects sourceHash change', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const allRules = loadAllRules(rulesDir);
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(compilerDataDir);

      const manifest = buildManifest({
        tools: ['claude-code'],
        scope: 'project',
        preset: preset.id,
        installedRules: rules.map((r) => r.id),
        sourceHash: 'aaaaaa', // 오래된 hash
      });
      writeManifest(resolveManifestPath(dir), manifest);

      const diff = computeDiff({
        previous: manifest,
        currentRules: rules.map((r) => r.id),
        currentSourceHash: sourceHash,
      });

      expect(diff.sourceChanged).toBe(true);
      expect(diff.status).toBe('changed');
    } finally {
      cleanup();
    }
  });

  it('computeDiff returns up-to-date when nothing changed', () => {
    const allRules = loadAllRules(rulesDir);
    const presets = loadPresets(presetsPath);
    const preset = presets[0];
    const rules = resolvePresetRules(preset, allRules);
    const sourceHash = computeSourceHash(compilerDataDir);

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      preset: preset.id,
      installedRules: rules.map((r) => r.id),
      sourceHash,
    });

    const diff = computeDiff({
      previous: manifest,
      currentRules: rules.map((r) => r.id),
      currentSourceHash: sourceHash,
    });

    expect(diff.status).toBe('up-to-date');
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});

describe('E2E: uninstall flow', () => {
  const rulesDir = resolveRulesDir();
  const presetsPath = resolvePresetsPath();

  it('init → uninstall: 파일 및 manifest 모두 제거', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const allRules = loadAllRules(rulesDir);
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(compilerDataDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      // install
      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const installResult = installFiles(dir, actions, meta);
      expect(installResult.written.length).toBeGreaterThan(0);

      const manifest = buildManifest({
        tools: ['claude-code'],
        scope: 'project',
        preset: preset.id,
        installedRules: rules.map((r) => r.id),
        installedFiles: installResult.written,
        sourceHash,
      });
      const manifestPath = resolveManifestPath(dir);
      writeManifest(manifestPath, manifest);

      // manifest에 installed_files 저장 확인
      const loaded = readManifest(manifestPath);
      expect(loaded?.installed_files).toEqual(installResult.written);

      // uninstall
      const uninstallResult = removeFiles(dir, installResult.written);
      expect(uninstallResult.deleted).toEqual(installResult.written);
      expect(uninstallResult.skipped).toHaveLength(0);

      // 파일 모두 삭제 확인
      for (const rel of installResult.written) {
        expect(existsSync(join(dir, rel))).toBe(false);
      }
    } finally {
      cleanup();
    }
  });
});

describe('E2E: diff flow', () => {
  const rulesDir = resolveRulesDir();
  const presetsPath = resolvePresetsPath();

  it('computeDiff detects added/removed rules', () => {
    const allRules = loadAllRules(rulesDir);
    const presets = loadPresets(presetsPath);
    const preset = presets[0];
    const rules = resolvePresetRules(preset, allRules);
    const sourceHash = computeSourceHash(compilerDataDir);

    const installedIds = rules.map((r) => r.id);
    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      preset: preset.id,
      installedRules: installedIds,
      sourceHash,
    });

    // rule 하나 추가, 하나 제거 시나리오
    const modifiedIds = [...installedIds.slice(1), 'hypothetical-new-rule'];

    const diff = computeDiff({
      previous: manifest,
      currentRules: modifiedIds,
      currentSourceHash: sourceHash,
    });

    expect(diff.status).toBe('changed');
    expect(diff.removed).toContain(installedIds[0]);
    expect(diff.added).toContain('hypothetical-new-rule');
  });
});
