import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  auditProjectLayer,
  diffProjectLayer,
  installProjectLayer,
  loadProjectLayerTemplateSpecs,
  parseProjectLayerManifest,
  readProjectLayerContextIndex,
  readProjectLayerManifest,
  resolveProjectLayerTools,
  uninstallProjectLayer,
  updateProjectLayer,
} from '../../features/project-layer/index.js';
import type { ProjectLayerManifest } from '../schemas/index.js';

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
    expect(paths).toContain('docs/agent/rules/00-agent-baseline.md');
    expect(paths).not.toContain('GEMINI.md');
    expect(paths).not.toContain('CLAUDE.md');

    const reservedSpecs = specs.filter((spec) => spec.frontmatter.status === 'Reserved');
    expect(reservedSpecs.map((spec) => spec.path)).toEqual([
      'docs/agent/maps/codebase-map.md',
      'docs/business/business-rules.md',
      'docs/business/terminology.md',
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

  it('rejects manifest paths that escape the project root', () => {
    const unsafeManifestJson = JSON.stringify({
      schemaVersion: 1,
      kind: 'project-operating-layer',
      tools: ['codex'],
      managed_files: [{ path: '../victim.md', sourceHash: 'aaaaaa' }],
      project_files: [],
      settings: {},
      sourceHash: 'aaaaaa',
      cliVersion: 'test',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(() => parseProjectLayerManifest(unsafeManifestJson)).toThrow();
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
      expect(result.manifest.managed_files.map((file) => file.path)).toContain(
        'docs/agent/rules/00-agent-baseline.md',
      );
      expect(result.manifest.managed_files.map((file) => file.path)).toContain('docs/agent/terminology.md');
      expect(result.manifest.project_files.map((file) => file.path)).toContain('docs/business/terminology.md');
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain(
        '| docs/agent/rules/00-agent-baseline.md | Active | ai-ops |',
      );
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain(
        '| docs/business/terminology.md | Reserved | project |',
      );
      expect(readProjectFile(dir, 'docs/agent/rules/00-agent-baseline.md')).toContain(
        '## 유지보수/리팩토링 기준',
      );
      expect(readProjectFile(dir, 'docs/agent/rules/00-agent-baseline.md')).toContain(
        'production TypeScript 파일이 600줄을 넘으면',
      );
      expect(readProjectFile(dir, 'docs/agent/checks/impact-checklist.md')).toContain(
        'touched production file이 250줄을 넘는가?',
      );
      expect(readProjectFile(dir, 'docs/agent/checks/impact-checklist.md')).toContain(
        '같은 패턴이 세 번째 등장했는가?',
      );
      expect(readProjectLayerContextIndex(dir)?.documents.map((document) => document.path)).toContain(
        'docs/agent/rules/00-agent-baseline.md',
      );
      expect(readProjectLayerContextIndex(dir)?.documents.map((document) => document.path)).toContain(
        'docs/business/terminology.md',
      );
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
      const terminologyPath = join(dir, 'docs/business/terminology.md');
      const customBusinessRules = readFileSync(businessRulesPath, 'utf-8').replace('- TBD', '- 결제 정책은 서버 응답을 우선한다.');
      const customTerminology = readFileSync(terminologyPath, 'utf-8').replace(
        '| TBD | TBD | TBD | TBD | TBD | TBD | TBD |',
        '| 결제 | `payment` | 사용자 결제 행위 | product / ui | payment | 결재 | `10_product-spec.md` |',
      );
      writeFileSync(businessRulesPath, customBusinessRules, 'utf-8');
      writeFileSync(terminologyPath, customTerminology, 'utf-8');

      const result = updateProjectLayer({ basePath: dir, manifest: installed.manifest });

      expect(readProjectFile(dir, 'docs/business/business-rules.md')).toContain('결제 정책은 서버 응답을 우선한다.');
      expect(readProjectFile(dir, 'docs/business/terminology.md')).toContain('사용자 결제 행위');
      expect(result.preservedProjectFiles).toContain('docs/business/business-rules.md');
      expect(result.preservedProjectFiles).toContain('docs/business/terminology.md');
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('updates docs-status when a formatter aligns the table header', () => {
    const { dir, cleanup } = setup();
    try {
      const installed = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const statusPath = join(dir, 'docs/docs-status.md');
      const formattedStatus = readFileSync(statusPath, 'utf-8').replace(
        '| path | status | owner |\n| --- | --- | --- |',
        '| path                                  | status   | owner   |\n| ------------------------------------- | -------- | ------- |',
      );
      writeFileSync(statusPath, formattedStatus, 'utf-8');

      const result = updateProjectLayer({ basePath: dir, manifest: installed.manifest });

      expect(result.preservedProjectFiles).toContain('docs/docs-status.md');
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain(
        '| docs/agent/rules/00-agent-baseline.md | Active | ai-ops |',
      );
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('adds newly introduced managed baseline documents during update', () => {
    const { dir, cleanup } = setup();
    try {
      const installed = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const baselinePath = 'docs/agent/rules/00-agent-baseline.md';
      const previousManifest: ProjectLayerManifest = {
        ...installed.manifest,
        managed_files: installed.manifest.managed_files.filter((file) => file.path !== baselinePath),
      };
      rmSync(join(dir, baselinePath));

      const result = updateProjectLayer({ basePath: dir, manifest: previousManifest });

      expect(result.written).toContain(baselinePath);
      expect(result.manifest.managed_files.map((file) => file.path)).toContain(baselinePath);
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain(
        '| docs/agent/rules/00-agent-baseline.md | Active | ai-ops |',
      );
      expect(readProjectLayerContextIndex(dir)?.documents.map((document) => document.path)).toContain(baselinePath);
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
      const terminologyPath = join(dir, 'docs/business/terminology.md');
      writeFileSync(businessRulesPath, readFileSync(businessRulesPath, 'utf-8').replace('- TBD', '- 직접 보강한 규칙'), 'utf-8');
      writeFileSync(
        terminologyPath,
        readFileSync(terminologyPath, 'utf-8').replace(
          '| TBD | TBD | TBD | TBD | TBD | TBD | TBD |',
          '| 루틴 | `routine` | 운동 계획 단위 | product | 프로그램 | 플랜 | `10_product-spec.md` |',
        ),
        'utf-8',
      );

      const result = uninstallProjectLayer(dir, installed.manifest);

      expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/docs-status.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/agent/maps/codebase-map.md'))).toBe(false);
      expect(existsSync(businessRulesPath)).toBe(true);
      expect(existsSync(terminologyPath)).toBe(true);
      expect(result.preserved).toContain('docs/business/business-rules.md');
      expect(result.preserved).toContain('docs/business/terminology.md');
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
      expect(existsSync(join(dir, 'docs/business/terminology.md'))).toBe(false);
      expect(existsSync(join(dir, 'docs/business/business-rules.md'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('retires old adapters when init is repeated with a smaller tool set', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({
        basePath: dir,
        tools: resolveProjectLayerTools(['codex', 'gemini', 'claude-code']),
      });

      const codexOnly = installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      expect(existsSync(join(dir, 'GEMINI.md'))).toBe(false);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
      expect(readProjectFile(dir, 'docs/docs-status.md')).not.toContain('GEMINI.md');
      expect(readProjectFile(dir, 'docs/docs-status.md')).not.toContain('CLAUDE.md');
      expect(codexOnly.manifest.managed_files.map((file) => file.path)).not.toContain('GEMINI.md');
      expect(codexOnly.manifest.managed_files.map((file) => file.path)).not.toContain('CLAUDE.md');
      expect(codexOnly.refreshedProjectFiles).toContain('docs/docs-status.md');
      expect(auditProjectLayer(dir).issues).toHaveLength(0);

      uninstallProjectLayer(dir, codexOnly.manifest);

      expect(existsSync(join(dir, 'GEMINI.md'))).toBe(false);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('does not delete outside files even if uninstall receives an unsafe manifest object', () => {
    const { dir, cleanup } = setup();
    const victimName = `${basename(dir)}-victim.md`;
    const victimPath = join(dirname(dir), victimName);
    try {
      writeFileSync(victimPath, 'keep me', 'utf-8');
      const unsafeManifest: ProjectLayerManifest = {
        schemaVersion: 1,
        kind: 'project-operating-layer',
        tools: ['codex'],
        managed_files: [{ path: `../${victimName}`, sourceHash: 'aaaaaa' }],
        project_files: [],
        settings: {},
        sourceHash: 'aaaaaa',
        cliVersion: 'test',
        generatedAt: '2026-01-01T00:00:00.000Z',
      };

      expect(() => uninstallProjectLayer(dir, unsafeManifest)).toThrow('Unsafe project layer path');
      expect(readFileSync(victimPath, 'utf-8')).toBe('keep me');
    } finally {
      rmSync(victimPath, { force: true });
      cleanup();
    }
  });
});
