import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { installSubagentPackages, removeSubagentFiles } from '../lib/subagent-install.js';

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'subagent-install-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

describe('subagent install/remove path safety', () => {
  it('AI_OPS_HOME 밖으로 나가는 install path를 거부한다', () => {
    const { dir, cleanup } = setup();
    try {
      expect(() =>
        installSubagentPackages(dir, [
          {
            subagentId: 'security-gate',
            files: [
              {
                relativePath: '../security-gate.toml',
                content: 'name = "security-gate"',
              },
            ],
          },
        ]),
      ).toThrow('Subagent path escapes AI_OPS_HOME');
    } finally {
      cleanup();
    }
  });

  it('AI_OPS_HOME 밖으로 나가는 remove path를 거부하고 외부 파일을 보존한다', () => {
    const { dir, cleanup } = setup();
    const outsideName = `${basename(dir)}-outside-security-gate.toml`;
    const outsidePath = join(dir, '..', outsideName);
    try {
      writeFileSync(outsidePath, 'keep', 'utf-8');

      expect(() => removeSubagentFiles(dir, [`../${outsideName}`])).toThrow('Subagent path escapes AI_OPS_HOME');
      expect(existsSync(outsidePath)).toBe(true);
    } finally {
      rmSync(outsidePath, { force: true });
      cleanup();
    }
  });
});
