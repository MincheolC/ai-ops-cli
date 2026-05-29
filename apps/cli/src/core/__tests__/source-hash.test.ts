import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeHash,
  computeSourceHash,
  computeInstalledSkillHash,
  computeInstalledSubagentHash,
} from '../../shared/source-hash.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, '../../../data');

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
      mkdirSync(join(tmpDataDir, 'skills', 'reference-skills', 'demo-skill', 'references'), { recursive: true });
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
                groups: ['frontend-web'],
                source_path: 'reference-skills/demo-skill',
              },
            ],
          },
          null,
          2,
        ) + '\n',
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
                groups: ['frontend-web'],
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

describe('computeInstalledSubagentHash', () => {
  it('PROMPT와 metadata 변경을 해시에 반영한다', () => {
    const firstHash = computeInstalledSubagentHash({
      id: 'security-gate',
      tools: ['codex'],
      prompt: 'Prompt',
      metadataFiles: ['codex:name = "security-gate"'],
    });
    const secondHash = computeInstalledSubagentHash({
      id: 'security-gate',
      tools: ['codex'],
      prompt: 'Prompt changed',
      metadataFiles: ['codex:name = "security-gate"'],
    });
    const thirdHash = computeInstalledSubagentHash({
      id: 'security-gate',
      tools: ['codex'],
      prompt: 'Prompt',
      metadataFiles: ['codex:name = "security-gate"\nmodel = "gpt-5.4-mini"'],
    });

    expect(secondHash).not.toBe(firstHash);
    expect(thirdHash).not.toBe(firstHash);
  });
});
