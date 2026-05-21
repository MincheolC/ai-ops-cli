import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSubagentManifest,
  readSubagentManifest,
  resolveSubagentManifestPath,
  serializeSubagentManifest,
  SUBAGENT_MANIFEST_FILENAME,
  writeSubagentManifest,
} from '../../features/subagents/manifest-io.js';
import type { SubagentManifest } from '../schemas/index.js';

const VALID_MANIFEST: SubagentManifest = {
  subagents: [
    {
      id: 'security-gate',
      tools: ['codex'],
      installed_paths: ['.codex/agents/security-gate.toml'],
      sourceHash: 'a1b2c3',
    },
  ],
  cliVersion: '0.2.6',
  generatedAt: '2026-05-15T00:00:00.000Z',
};

describe('subagent manifest I/O', () => {
  it('serialize → parse roundtrip', () => {
    expect(parseSubagentManifest(serializeSubagentManifest(VALID_MANIFEST))).toEqual(VALID_MANIFEST);
  });

  it('resolveSubagentManifestPath는 global manifest 파일명을 사용한다', () => {
    expect(resolveSubagentManifestPath('/tmp/home')).toBe(`/tmp/home/.ai-ops/${SUBAGENT_MANIFEST_FILENAME}`);
  });

  it('write → read roundtrip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'subagent-manifest-test-'));
    try {
      const path = resolveSubagentManifestPath(dir);
      writeSubagentManifest(path, VALID_MANIFEST);
      expect(readSubagentManifest(path)).toEqual(VALID_MANIFEST);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
