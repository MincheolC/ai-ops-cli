import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  auditProjectLayer,
  diffProjectLayer,
  installProjectLayer,
  loadProjectLayerTemplateSpecs,
  readProjectLayerManifest,
  resolveProjectLayerTools,
  uninstallProjectLayer,
  updateProjectLayer,
} from '../project-layer.js';

const setup = (): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'project-layer-test-'));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const readProjectFile = (basePath: string, relativePath: string): string =>
  readFileSync(join(basePath, relativePath), 'utf-8');

describe('project operating layer templates', () => {
  it('loads selected tool adapters and validates Reserved warning text', () => {
    const specs = loadProjectLayerTemplateSpecs(resolveProjectLayerTools(['codex']));
    const paths = specs.map((spec) => spec.path);

    expect(paths).toContain('AGENTS.md');
    expect(paths).not.toContain('GEMINI.md');
    expect(paths).not.toContain('CLAUDE.md');

    const reservedSpecs = specs.filter((spec) => spec.frontmatter.status === 'Reserved');
    expect(reservedSpecs.map((spec) => spec.path)).toEqual([
      'docs/agent/maps/codebase-map.md',
      'docs/business/business-rules.md',
    ]);
    expect(reservedSpecs.every((spec) => spec.content.includes('판단 근거로 사용하지 마세요'))).toBe(true);
  });

  it('does not read the old root manifest path', () => {
    const { dir, cleanup } = setup();
    try {
      writeFileSync(join(dir, '.ai-ops-manifest.json'), '{"sourceHash":"aaaaaa"}\n', 'utf-8');
      expect(readProjectLayerManifest(dir)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe('project operating layer lifecycle', () => {
  it('installs codex layer without Gemini or Claude adapters', () => {
    const { dir, cleanup } = setup();
    try {
      const result = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(dir, 'GEMINI.md'))).toBe(false);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops/manifest.json'))).toBe(true);
      expect(existsSync(join(dir, '.ai-ops/context-layer.json'))).toBe(true);
      expect(result.manifest.kind).toBe('project-operating-layer');
      expect(result.manifest.tools).toEqual(['codex']);
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('installs all selected root adapters', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({
        basePath: dir,
        tools: resolveProjectLayerTools(['codex', 'gemini', 'claude-code']),
      });

      expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
      expect(existsSync(join(dir, 'GEMINI.md'))).toBe(true);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(true);
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('updates managed files and preserves project-owned content', () => {
    const { dir, cleanup } = setup();
    try {
      const installed = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const businessRulesPath = join(dir, 'docs/business/business-rules.md');
      const customBusinessRules = readFileSync(businessRulesPath, 'utf-8').replace('- TBD', '- 결제 정책은 서버 응답을 우선한다.');
      writeFileSync(businessRulesPath, customBusinessRules, 'utf-8');

      const result = updateProjectLayer({ basePath: dir, manifest: installed.manifest });

      expect(readProjectFile(dir, 'docs/business/business-rules.md')).toContain('결제 정책은 서버 응답을 우선한다.');
      expect(result.preservedProjectFiles).toContain('docs/business/business-rules.md');
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('diff detects missing files and managed sourceHash drift', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      expect(diffProjectLayer(dir).issues).toHaveLength(0);

      rmSync(join(dir, 'docs/agent/workflow.md'));
      const missingReport = diffProjectLayer(dir);
      expect(missingReport.issues.some((item) => item.code === 'missing-file')).toBe(true);

      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const agentsPath = join(dir, 'AGENTS.md');
      const staleAgents = readFileSync(agentsPath, 'utf-8').replace(/sourceHash: [a-f0-9]{6}/, 'sourceHash: bbbbbb');
      writeFileSync(agentsPath, staleAgents, 'utf-8');

      const staleReport = diffProjectLayer(dir);
      expect(staleReport.issues.some((item) => item.code === 'managed-source-hash-drift')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('audit reports docs-status mismatch without writing files', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const statusPath = join(dir, 'docs/docs-status.md');
      const before = readFileSync(statusPath, 'utf-8');
      writeFileSync(statusPath, before.replace('| AGENTS.md | Active | ai-ops |', '| AGENTS.md | Draft | ai-ops |'), 'utf-8');

      const report = auditProjectLayer(dir);

      expect(report.issues.some((item) => item.code === 'docs-status-mismatch')).toBe(true);
      expect(readFileSync(statusPath, 'utf-8')).toContain('| AGENTS.md | Draft | ai-ops |');
    } finally {
      cleanup();
    }
  });

  it('uninstall removes unmodified create-only files and preserves modified project-owned files', () => {
    const { dir, cleanup } = setup();
    try {
      const installed = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const businessRulesPath = join(dir, 'docs/business/business-rules.md');
      writeFileSync(businessRulesPath, readFileSync(businessRulesPath, 'utf-8').replace('- TBD', '- 직접 보강한 규칙'), 'utf-8');

      const result = uninstallProjectLayer(dir, installed.manifest);

      expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/docs-status.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/agent/maps/codebase-map.md'))).toBe(false);
      expect(existsSync(businessRulesPath)).toBe(true);
      expect(result.preserved).toContain('docs/business/business-rules.md');
      expect(existsSync(join(dir, '.ai-ops/manifest.json'))).toBe(false);
      expect(existsSync(join(dir, '.ai-ops/context-layer.json'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('keeps create-only ownership when init is repeated', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const installedAgain = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      uninstallProjectLayer(dir, installedAgain.manifest);

      expect(existsSync(join(dir, 'docs/docs-status.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/agent/maps/codebase-map.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/business/business-rules.md'))).toBe(false);
    } finally {
      cleanup();
    }
  });
});
