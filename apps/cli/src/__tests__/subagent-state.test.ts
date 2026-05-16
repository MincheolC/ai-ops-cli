import { describe, expect, it } from 'vitest';
import {
  findInstalledSubagent,
  mergeSubagentTools,
  removeInstalledSubagent,
  resolveInstalledSubagentPaths,
  resolveRequestedSubagentTools,
  upsertInstalledSubagent,
} from '../lib/subagent-state.js';
import type { InstalledSubagent } from '@/core/index.js';

const installedSubagent: InstalledSubagent = {
  id: 'security-gate',
  tools: ['codex'],
  installed_paths: ['.codex/agents/security-gate.toml'],
  sourceHash: 'abc123',
};

describe('subagent-state', () => {
  it('requested tools가 없으면 supported 전체를 사용한다', () => {
    expect(resolveRequestedSubagentTools({ supported: ['codex', 'gemini'] })).toEqual(['codex', 'gemini']);
  });

  it('지원하지 않는 tool 요청을 거부한다', () => {
    expect(() =>
      resolveRequestedSubagentTools({
        requested: ['codex', 'unknown'],
        supported: ['codex'],
      }),
    ).toThrow('Unsupported tools requested: unknown');
  });

  it('기존 설치 tool과 신규 요청 tool을 merge한다', () => {
    expect(mergeSubagentTools({ existing: ['codex'], requested: ['claude-code'] })).toEqual([
      'claude-code',
      'codex',
    ]);
  });

  it('installed subagent upsert/remove/find', () => {
    const updated = upsertInstalledSubagent([installedSubagent], {
      ...installedSubagent,
      sourceHash: 'ff1122',
    });

    expect(updated).toHaveLength(1);
    expect(findInstalledSubagent(updated, 'security-gate')?.sourceHash).toBe('ff1122');
    expect(removeInstalledSubagent(updated, 'security-gate')).toEqual([]);
  });

  it('uninstall 경로는 manifest installed_paths가 아니라 id와 tools에서 재계산한다', () => {
    expect(
      resolveInstalledSubagentPaths({
        ...installedSubagent,
        tools: ['claude-code', 'codex'],
        installed_paths: ['stale-or-corrupt-path'],
      }),
    ).toEqual(['.claude/agents/security-gate.md', '.codex/agents/security-gate.toml']);
  });
});
