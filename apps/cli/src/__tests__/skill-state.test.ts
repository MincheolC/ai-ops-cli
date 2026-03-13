import { describe, expect, it } from 'vitest';
import {
  resolveSkillScope,
  resolveRequestedTools,
  upsertInstalledSkill,
  removeInstalledSkill,
  findInstalledSkill,
} from '../lib/skill-state.js';

const installedSkill = {
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

  it('installed skill upsert/remove/find', () => {
    const updated = upsertInstalledSkill([installedSkill], { ...installedSkill, sourceHash: 'ff1122' });
    expect(updated).toHaveLength(1);
    expect(findInstalledSkill(updated, 'skill-load-check')?.sourceHash).toBe('ff1122');
    expect(removeInstalledSkill(updated, 'skill-load-check')).toEqual([]);
  });
});
