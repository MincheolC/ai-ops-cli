import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildStudioSnapshot,
  installProjectLayer,
  parseProjectLayerDocument,
  readProjectLayerContextIndex,
  resolveProjectLayerTools,
  serializeProjectLayerContextIndex,
  writeIntegrationManifest,
  writeSkillRegistry,
  writeSubagentManifest,
} from '../index.js';

const GENERATED_AT = '2026-05-19T06:00:00.000Z';

const setup = (): { dir: string; userHome: string; codexHome: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'studio-snapshot-project-'));
  const userHome = mkdtempSync(join(tmpdir(), 'studio-snapshot-home-'));
  const codexHome = join(userHome, '.codex');
  return {
    dir,
    userHome,
    codexHome,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
      rmSync(userHome, { recursive: true, force: true });
    },
  };
};

const buildSnapshotForTest = (params: { dir: string; userHome: string | null; codexHome: string | null }) =>
  buildStudioSnapshot({
    basePath: params.dir,
    userBasePath: params.userHome,
    codexHomePath: params.codexHome,
    generatedAt: GENERATED_AT,
    cliVersion: 'test',
  });

const listFiles = (root: string): string[] => {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  const walk = (relativeDir = ''): void => {
    const absoluteDir = relativeDir.length > 0 ? join(root, relativeDir) : root;
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relativePath = relativeDir.length > 0 ? join(relativeDir, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }
      files.push(relativePath);
    }
  };

  walk();
  return files;
};

describe('studio snapshot core', () => {
  it('builds a ready project snapshot from context-layer documents only', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });
      const contextIndex = readProjectLayerContextIndex(dir);

      expect(snapshot.kind).toBe('ai-ops-studio-snapshot');
      expect(snapshot.project.state).toBe('ready');
      expect(snapshot.project.documents.map((document) => document.path)).toEqual(
        contextIndex?.documents.map((document) => document.path),
      );
      expect(snapshot.project.documents.map((document) => document.path)).not.toContain('package.json');
      expect(snapshot.project.audit.hasErrors).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('reports uninitialized projects without creating .ai-ops', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      const before = listFiles(dir);
      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });
      const after = listFiles(dir);

      expect(snapshot.project.state).toBe('uninitialized');
      expect(snapshot.project.files.manifest.exists).toBe(false);
      expect(snapshot.project.audit.issues.some((issue) => issue.code === 'missing-manifest')).toBe(true);
      expect(existsSync(join(dir, '.ai-ops'))).toBe(false);
      expect(after).toEqual(before);
    } finally {
      cleanup();
    }
  });

  it('keeps snapshot generation alive for invalid project sources', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      writeFileSync(join(dir, '.ai-ops/manifest.json'), '{broken', 'utf-8');
      writeFileSync(join(dir, '.ai-ops/context-layer.json'), '{"schemaVersion":1}\n', 'utf-8');
      writeFileSync(join(dir, 'docs/docs-status.md'), '# Missing frontmatter\n', 'utf-8');

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });

      expect(snapshot.project.state).toBe('degraded');
      expect(snapshot.project.files.manifest.parsed).toBe(false);
      expect(snapshot.project.files.contextIndex.parsed).toBe(false);
      expect(snapshot.project.files.docsStatus.parsed).toBe(false);
      expect(snapshot.project.documents).toEqual([]);
      expect(snapshot.project.audit.issues.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it('keeps valid context documents when another context document has an unsafe path', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const contextIndex = readProjectLayerContextIndex(dir);
      const firstDocument = contextIndex?.documents[0];
      const secondDocument = contextIndex?.documents[1];
      if (contextIndex === null || firstDocument === undefined || secondDocument === undefined) {
        throw new Error('context index missing documents in test setup');
      }
      writeFileSync(
        join(dir, '.ai-ops/context-layer.json'),
        JSON.stringify(
          {
            ...contextIndex,
            documents: [
              firstDocument,
              {
                ...secondDocument,
                path: '../outside.md',
              },
            ],
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });
      const unsafeDocument = snapshot.project.documents.find((document) => document.path === '../outside.md');

      expect(snapshot.project.state).toBe('degraded');
      expect(snapshot.project.files.contextIndex.parsed).toBe(false);
      expect(snapshot.project.documents.find((document) => document.path === firstDocument.path)?.readError).toBeNull();
      expect(unsafeDocument?.readError).toContain('unsafe-path');
      expect(snapshot.project.documents).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('marks context-layer-only documents without treating manifest as a fallback source', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      const extraPath = 'docs/agent/extra-context.md';
      const extraContent = [
        '---',
        'status: Active',
        'layer: agent',
        'owner: project',
        'read_when:',
        '  - before_task',
        'update_when:',
        '  - extra_context_changes',
        '---',
        '# Extra Context',
        '',
      ].join('\n');
      mkdirSync(join(dir, 'docs/agent'), { recursive: true });
      writeFileSync(join(dir, extraPath), extraContent, 'utf-8');

      const contextIndex = readProjectLayerContextIndex(dir);
      if (contextIndex === null) {
        throw new Error('context index missing in test setup');
      }
      const { content: _content, ...extraDocument } = parseProjectLayerDocument(extraPath, extraContent);
      writeFileSync(
        join(dir, '.ai-ops/context-layer.json'),
        serializeProjectLayerContextIndex({
          ...contextIndex,
          documents: [...contextIndex.documents, extraDocument],
        }),
        'utf-8',
      );

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });
      const extra = snapshot.project.documents.find((document) => document.path === extraPath);

      expect(extra?.provenance).toBe('context-only');
      expect(snapshot.project.audit.issues.some((issue) => issue.code === 'context-extra-document')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('adds trust warnings for Reserved documents', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });
      const reserved = snapshot.project.documents.find((document) => document.status === 'Reserved');

      expect(reserved?.trustWarning).toContain('not current decision-making evidence');
    } finally {
      cleanup();
    }
  });

  it('shows runtime catalogs as not installed when manifests are absent', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });

      expect(snapshot.runtime.available).toBe(true);
      expect(snapshot.runtime.integrations.map((integration) => integration.id)).toEqual(['context-promotion', 'pc']);
      expect(snapshot.runtime.integrations.every((integration) => integration.installed === false)).toBe(true);
      expect(snapshot.runtime.skills.length).toBeGreaterThan(0);
      expect(snapshot.runtime.skills.every((skill) => skill.installed === false)).toBe(true);
      expect(snapshot.runtime.subagents.length).toBeGreaterThan(0);
      expect(snapshot.runtime.subagents.every((subagent) => subagent.installed === false)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('combines installed runtime manifests and path existence without mutating files', () => {
    const { dir, userHome, codexHome, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      mkdirSync(join(userHome, '.agents/skills/skill-load-check'), { recursive: true });
      writeFileSync(join(userHome, '.agents/skills/skill-load-check/SKILL.md'), '# skill\n', 'utf-8');
      mkdirSync(join(userHome, '.codex/agents'), { recursive: true });
      writeFileSync(join(userHome, '.codex/agents/security-gate.toml'), 'name = "security-gate"\n', 'utf-8');
      writeSkillRegistry(join(userHome, '.ai-ops/skills-manifest.json'), {
        skills: [
          {
            id: 'skill-load-check',
            kind: 'task',
            tools: ['codex'],
            installed_paths: ['.agents/skills/skill-load-check/SKILL.md'],
            sourceHash: 'aaaaaa',
          },
        ],
        cliVersion: 'test',
        generatedAt: GENERATED_AT,
      });
      writeSubagentManifest(join(userHome, '.ai-ops/subagents-manifest.json'), {
        subagents: [
          {
            id: 'security-gate',
            tools: ['codex'],
            installed_paths: ['.codex/agents/security-gate.toml'],
            sourceHash: 'bbbbbb',
          },
        ],
        cliVersion: 'test',
        generatedAt: GENERATED_AT,
      });
      writeIntegrationManifest(join(userHome, '.ai-ops/integrations-manifest.json'), {
        schemaVersion: 1,
        kind: 'ai-ops-integrations-manifest',
        integrations: [
          {
            id: 'context-promotion',
            installedAt: GENERATED_AT,
            updatedAt: GENERATED_AT,
            components: [
              {
                type: 'skill',
                id: 'context-promotion-review',
                tools: ['codex'],
                owned: true,
              },
              {
                type: 'codex-hook',
                id: 'context-promotion',
                command: 'ai-ops context-promotion hook post-tool-use',
                owned: true,
              },
              {
                type: 'receipt-config',
                id: 'context-promotion-receipts',
                storagePath: '.ai-ops/context-promotion/projects/demo/receipts-index.json',
                owned: true,
              },
            ],
          },
        ],
        cliVersion: 'test',
        generatedAt: GENERATED_AT,
      });
      const beforeProject = listFiles(dir);
      const beforeRuntime = listFiles(userHome);

      const snapshot = buildSnapshotForTest({ dir, userHome, codexHome });

      expect(snapshot.runtime.skills.find((skill) => skill.id === 'skill-load-check')?.installedPaths[0]?.exists).toBe(
        true,
      );
      expect(snapshot.runtime.subagents.find((subagent) => subagent.id === 'security-gate')?.installedPaths[0]?.exists).toBe(
        true,
      );
      expect(snapshot.runtime.integrations.find((integration) => integration.id === 'context-promotion')?.installed).toBe(
        true,
      );
      expect(listFiles(dir)).toEqual(beforeProject);
      expect(listFiles(userHome)).toEqual(beforeRuntime);
    } finally {
      cleanup();
    }
  });

  it('marks runtime unavailable without failing when home paths are missing', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      const snapshot = buildSnapshotForTest({ dir, userHome: null, codexHome: null });

      expect(snapshot.runtime.available).toBe(false);
      expect(snapshot.runtime.unavailableReason).toContain('AI_OPS_HOME or HOME');
      expect(snapshot.runtime.integrations.length).toBeGreaterThan(0);
      expect(snapshot.runtime.hooks.every((hook) => hook.error !== null)).toBe(true);
    } finally {
      cleanup();
    }
  });
});
