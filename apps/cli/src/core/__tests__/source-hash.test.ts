import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHash, computeSourceHash, computeInstalledSkillHash, buildManifest } from '../source-hash.js';
import { ManifestSchema } from '../schemas/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

afterEach(() => {
  vi.useRealTimers();
});

describe('computeHash', () => {
  it('동일 입력 → 동일 출력 (determinism)', () => {
    expect(computeHash(['a', 'b'])).toBe(computeHash(['a', 'b']));
  });

  it('6자리 hex 정규식 매칭', () => {
    expect(computeHash(['test'])).toMatch(/^[a-f0-9]{6}$/);
  });

  it('순서 다르면 다른 해시', () => {
    expect(computeHash(['a', 'b'])).not.toBe(computeHash(['b', 'a']));
  });

  it('빈 배열 → 유효 해시', () => {
    expect(computeHash([])).toMatch(/^[a-f0-9]{6}$/);
  });
});

describe('computeSourceHash', () => {
  it('실제 data/ 대상 2회 호출 동일 결과', () => {
    expect(computeSourceHash(dataDir)).toBe(computeSourceHash(dataDir));
  });

  it('skill-registry.json 변경도 hash에 반영된다', () => {
    const tmpDataDir = mkdtempSync(join(tmpdir(), 'ai-ops-source-hash-'));

    try {
      mkdirSync(join(tmpDataDir, 'rules'), { recursive: true });
      mkdirSync(join(tmpDataDir, 'skills', 'reference-skills', 'demo-skill', 'references'), { recursive: true });
      writeFileSync(
        join(tmpDataDir, 'rules', 'rule.yaml'),
        'id: role-persona\ncategory: general\ntags: []\npriority: 100\ncontent:\n  constraints: []\n  guidelines: []\n',
      );
      writeFileSync(
        join(tmpDataDir, 'skills', 'reference-skills', 'demo-skill', 'SKILL.md'),
        '---\nname: demo-skill\ndescription: Demo skill\n---\n# Demo Skill\n',
      );
      writeFileSync(
        join(tmpDataDir, 'skills', 'reference-skills', 'demo-skill', 'references', 'reference.md'),
        'demo reference\n',
      );
      writeFileSync(
        join(tmpDataDir, 'skills', 'skill-registry.json'),
        JSON.stringify(
          {
            skills: [
              {
                id: 'demo-skill',
                kind: 'reference',
                supported_tools: ['codex'],
                install_scopes: ['project'],
                groups: ['frontend-web'],
                included_in_presets: ['frontend-web'],
                source_path: 'reference-skills/demo-skill',
              },
            ],
          },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(
        join(tmpDataDir, 'presets.yaml'),
        "frontend-web:\n  description: 'demo'\n  rules:\n    - role-persona\n",
      );

      const firstHash = computeSourceHash(tmpDataDir);
      writeFileSync(
        join(tmpDataDir, 'skills', 'skill-registry.json'),
        JSON.stringify(
          {
            skills: [
              {
                id: 'demo-skill',
                kind: 'reference',
                supported_tools: ['codex', 'gemini'],
                install_scopes: ['project'],
                groups: ['frontend-web'],
                included_in_presets: ['frontend-web'],
                source_path: 'reference-skills/demo-skill',
              },
            ],
          },
          null,
          2,
        ) + '\n',
      );
      const secondHash = computeSourceHash(tmpDataDir);

      expect(firstHash).not.toBe(secondHash);
    } finally {
      rmSync(tmpDataDir, { recursive: true, force: true });
    }
  });
});

describe('computeInstalledSkillHash', () => {
  it('동일 skill 입력은 동일 해시', () => {
    expect(
      computeInstalledSkillHash({
        kind: 'task',
        description: 'desc',
        tools: ['codex'],
        files: ['SKILL.md:body', "scripts/loaded.js:console.log('A Skill loaded');"],
      }),
    ).toBe(
      computeInstalledSkillHash({
        kind: 'task',
        description: 'desc',
        tools: ['codex'],
        files: ['SKILL.md:body', "scripts/loaded.js:console.log('A Skill loaded');"],
      }),
    );
  });
});

describe('buildManifest', () => {
  it('정상 생성, ManifestSchema 통과', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      preset: 'frontend-web',
      installedRules: ['typescript', 'react-typescript'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.generatedAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('preset 생략 시 optional 처리', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.preset).toBeUndefined();
  });

  it('workspaces 포함 시 ManifestSchema 통과', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code', 'codex'],
      scope: 'project',
      workspaces: {
        'apps/web': { preset: 'frontend-web', rules: ['typescript', 'nextjs'] },
        'services/api': { preset: 'backend-ts', rules: ['typescript', 'nestjs'] },
      },
      installedRules: ['typescript', 'nextjs', 'nestjs'],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.workspaces?.['apps/web']?.preset).toBe('frontend-web');
  });

  it('installedFiles 포함 시 installed_files 필드 저장', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      installedFiles: ['.claude/rules/typescript.md'],
      installedSkills: [
        {
          id: 'graphql-contract',
          kind: 'reference',
          tools: ['codex'],
          scope: 'project',
          installed_paths: ['.agents/skills/graphql-contract'],
          sourceHash: 'abc123',
        },
      ],
      sourceHash: 'abc123',
    });

    expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    expect(manifest.installed_files).toEqual(['.claude/rules/typescript.md']);
    expect(manifest.installed_skills).toHaveLength(1);
  });

  it('installedFiles 생략 시 installed_files undefined', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const manifest = buildManifest({
      tools: ['claude-code'],
      scope: 'project',
      installedRules: ['typescript'],
      sourceHash: 'abc123',
    });

    expect(manifest.installed_files).toBeUndefined();
  });
});
