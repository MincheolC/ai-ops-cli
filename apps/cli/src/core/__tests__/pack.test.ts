import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  auditProjectLayer,
  installProjectLayer,
  installProjectLayerPack,
  loadAllPacks,
  resolveProjectLayerTools,
  uninstallProjectLayerPack,
  updateProjectLayerPack,
} from '../index.js';
import { COMPILER_DATA_DIR } from '../paths.js';

const setup = (): { dir: string; cleanup: () => void } => {
  const dir = mkdtempSync(join(tmpdir(), 'project-layer-pack-test-'));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
};

const readProjectFile = (basePath: string, relativePath: string): string =>
  readFileSync(join(basePath, relativePath), 'utf-8');

describe('pack source loading', () => {
  it('loads only the spec-lifecycle pack and separates documents from files', () => {
    const packs = loadAllPacks(join(COMPILER_DATA_DIR, 'packs'));

    expect(packs.map((pack) => pack.id)).toEqual(['spec-lifecycle']);
    expect(packs[0]?.documents.map((file) => file.path)).toEqual([
      'docs/specs/README.ko.md',
      'docs/specs/README.md',
    ]);
    expect(packs[0]?.files.map((file) => file.path)).toEqual([
      'docs/specs/baseline/.gitkeep',
      'docs/specs/initial-build/.gitkeep',
    ]);
    expect(packs[0]?.documents.find((file) => file.path === 'docs/specs/README.md')?.content).toContain(
      'Do not use this document as current decision-making evidence',
    );
    expect(packs[0]?.documents.find((file) => file.path === 'docs/specs/README.ko.md')?.content).toContain(
      '판단 근거로 사용하지 마세요',
    );
  });
});

describe('project layer pack lifecycle', () => {
  it('fails before the project operating layer exists', () => {
    const { dir, cleanup } = setup();
    try {
      expect(() => installProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' })).toThrow(
        '먼저 ai-ops init을 실행하세요',
      );
    } finally {
      cleanup();
    }
  });

  it('installs spec-lifecycle into docs/specs and records only markdown documents in the context layer', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });

      const result = installProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' });

      expect(existsSync(join(dir, 'docs/specs/README.md'))).toBe(true);
      expect(existsSync(join(dir, 'docs/specs/README.ko.md'))).toBe(true);
      expect(existsSync(join(dir, 'docs/specs/baseline/.gitkeep'))).toBe(true);
      expect(existsSync(join(dir, 'docs/specs/initial-build/.gitkeep'))).toBe(true);
      expect(result.manifest.packs.map((pack) => pack.id)).toEqual(['spec-lifecycle']);
      expect(result.manifest.packs[0]?.documents.map((file) => file.path)).toEqual([
        'docs/specs/README.ko.md',
        'docs/specs/README.md',
      ]);
      expect(result.manifest.packs[0]?.files.map((file) => file.path)).toEqual([
        'docs/specs/baseline/.gitkeep',
        'docs/specs/initial-build/.gitkeep',
      ]);
      expect(result.contextIndex.documents.map((document) => document.path)).toContain('docs/specs/README.md');
      expect(result.contextIndex.documents.map((document) => document.path)).toContain('docs/specs/README.ko.md');
      expect(result.contextIndex.documents.map((document) => document.path)).not.toContain(
        'docs/specs/baseline/.gitkeep',
      );
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain('| docs/specs/README.md | Reserved | project |');
      expect(readProjectFile(dir, 'docs/docs-status.md')).toContain(
        '| docs/specs/README.ko.md | Reserved | project |',
      );
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('updates only unmodified pack files and preserves a user-edited README', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      installProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' });
      const readmePath = join(dir, 'docs/specs/README.md');
      writeFileSync(
        readmePath,
        readFileSync(readmePath, 'utf-8').replace(
          '## Directory Structure',
          '## Project Notes\n\n- 사용자 작성 내용\n\n## Directory Structure',
        ),
        'utf-8',
      );

      const result = updateProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' });

      expect(readProjectFile(dir, 'docs/specs/README.md')).toContain('사용자 작성 내용');
      expect(result.preserved).toContain('docs/specs/README.md');
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });

  it('uninstalls unmodified pack files and keeps modified docs/specs files outside the index', () => {
    const { dir, cleanup } = setup();
    try {
      installProjectLayer({ basePath: dir, tools: resolveProjectLayerTools(['codex']) });
      installProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' });
      const readmePath = join(dir, 'docs/specs/README.md');
      writeFileSync(
        readmePath,
        readFileSync(readmePath, 'utf-8').replace(
          '## Directory Structure',
          '## Project Notes\n\n- 사용자 작성 내용\n\n## Directory Structure',
        ),
        'utf-8',
      );

      const result = uninstallProjectLayerPack({ basePath: dir, packId: 'spec-lifecycle' });

      expect(existsSync(readmePath)).toBe(true);
      expect(existsSync(join(dir, 'docs/specs/baseline/.gitkeep'))).toBe(false);
      expect(existsSync(join(dir, 'docs/specs/initial-build/.gitkeep'))).toBe(false);
      expect(result.preserved).toContain('docs/specs/README.md');
      expect(result.manifest.packs).toEqual([]);
      expect(result.contextIndex.documents.map((document) => document.path)).not.toContain('docs/specs/README.md');
      expect(readProjectFile(dir, 'docs/docs-status.md')).not.toContain('docs/specs/README.md');
      expect(auditProjectLayer(dir).issues).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});
