import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
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
  isManagedFile,
} from 'ai-ops-compiler';
import { installFiles } from '../lib/install.js';
import { removeFiles } from '../lib/uninstall.js';
import { resolveRulesDir, resolvePresetsPath } from '../lib/paths.js';

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
      const sourceHash = computeSourceHash(rulesDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      // claude-code
      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const result = installFiles(dir, actions);

      expect(result.written.length).toBeGreaterThan(0);
      expect(result.skipped).toHaveLength(0);

      // 파일 존재 + managed header 검증
      for (const rel of result.written) {
        const absPath = join(dir, rel);
        expect(existsSync(absPath)).toBe(true);
        const content = readFileSync(absPath, 'utf-8');
        expect(isManagedFile(content)).toBe(true);
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
      const sourceHash = computeSourceHash(rulesDir);
      const meta = { sourceHash, generatedAt: '2026-01-01T00:00:00.000Z' };

      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });

      installFiles(dir, actions);
      const firstContents = actions.map((a) => readFileSync(join(dir, a.relativePath), 'utf-8'));

      // 2nd install (same meta → content identical)
      installFiles(dir, actions);
      const secondContents = actions.map((a) => readFileSync(join(dir, a.relativePath), 'utf-8'));

      expect(firstContents).toEqual(secondContents);
    } finally {
      cleanup();
    }
  });

  it('managed file protection: non-managed 파일은 skip', () => {
    const { dir, cleanup } = setup();
    try {
      const presets = loadPresets(presetsPath);
      const preset = presets[0];
      const rules = resolvePresetRules(preset, allRules);
      const sourceHash = computeSourceHash(rulesDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const firstAction = actions[0];

      // 사용자가 직접 작성한 파일로 덮어쓰기
      const absPath = join(dir, firstAction.relativePath);
      mkdirSync(dirname(absPath), { recursive: true });
      writeFileSync(absPath, '# User content (not managed)', 'utf-8');

      const result = installFiles(dir, [firstAction]);
      expect(result.skipped).toContain(firstAction.relativePath);
      expect(result.written).not.toContain(firstAction.relativePath);

      // 파일 내용이 보존됐는지 확인
      const content = readFileSync(absPath, 'utf-8');
      expect(content).toBe('# User content (not managed)');
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
      const sourceHash = computeSourceHash(rulesDir);

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
    const sourceHash = computeSourceHash(rulesDir);

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
      const sourceHash = computeSourceHash(rulesDir);
      const meta = { sourceHash, generatedAt: new Date().toISOString() };

      // install
      const renderResult = renderForTool('claude-code', rules);
      const actions = buildInstallPlan({ toolId: 'claude-code', renderResult, meta });
      const installResult = installFiles(dir, actions);
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
    const sourceHash = computeSourceHash(rulesDir);

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
