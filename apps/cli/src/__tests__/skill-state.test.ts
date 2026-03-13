import { describe, expect, it } from 'vitest';
import {
  resolveSkillScope,
  resolveRequestedTools,
  mergeSkillTools,
  subtractSkillTools,
  upsertInstalledSkill,
  removeInstalledSkill,
  findInstalledSkill,
} from '../lib/skill-state.js';
import type { InstalledSkill } from '@/core/index.js';

const installedSkill: InstalledSkill = {
  id: 'skill-load-check',
  kind: 'task' as const,
  tools: ['codex'],
  scope: 'user' as const,
  installed_paths: ['.agents/skills/skill-load-check'],
  sourceHash: 'abc123',
};

describe('skill-state', () => {
  it('scope 기본값은 user', () => {
    expect(resolveSkillScope({})).toBe('user');
  });

  it('project alias를 해석한다', () => {
    expect(resolveSkillScope({ project: true })).toBe('project');
  });

  it('지원하지 않는 scope는 거부한다', () => {
    expect(() => resolveSkillScope({ scope: 'global' })).toThrow('Unsupported scope');
  });

  it('requested tools가 없으면 supported 전체를 사용한다', () => {
    expect(resolveRequestedTools({ supported: ['codex', 'gemini'] })).toEqual(['codex', 'gemini']);
  });

  it('기존 설치 tool과 신규 요청 tool을 merge한다', () => {
    expect(mergeSkillTools({ existing: ['codex'], requested: ['claude-code'] })).toEqual(['claude-code', 'codex']);
  });

  it('이미 설치된 tool을 제외한 missing tool만 계산한다', () => {
    expect(subtractSkillTools({ requested: ['claude-code', 'codex'], installed: ['codex'] })).toEqual(['claude-code']);
  });

  it('installed skill upsert/remove/find', () => {
    const updated = upsertInstalledSkill([installedSkill], { ...installedSkill, sourceHash: 'ff1122' });
    expect(updated).toHaveLength(1);
    expect(findInstalledSkill(updated, 'skill-load-check')?.sourceHash).toBe('ff1122');
    expect(removeInstalledSkill(updated, 'skill-load-check')).toEqual([]);
  });

  it('legacy skill id를 canonical id로 취급한다', () => {
    const legacyInstalledSkill: InstalledSkill = {
      id: 'engineering-standards-pack',
      kind: 'reference' as const,
      tools: ['codex'],
      scope: 'project' as const,
      installed_paths: ['.agents/skills/engineering-standards-pack'],
      sourceHash: 'abc123',
    };

    expect(findInstalledSkill([legacyInstalledSkill], 'backend-service-standards')).toEqual(legacyInstalledSkill);
    expect(removeInstalledSkill([legacyInstalledSkill], 'backend-service-standards')).toEqual([]);
    expect(
      upsertInstalledSkill([legacyInstalledSkill], {
        ...legacyInstalledSkill,
        id: 'backend-service-standards',
        installed_paths: ['.agents/skills/backend-service-standards'],
      }),
    ).toEqual([
      {
        ...legacyInstalledSkill,
        id: 'backend-service-standards',
        installed_paths: ['.agents/skills/backend-service-standards'],
      },
    ]);
  });
});
