import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseSkillRegistry,
  serializeSkillRegistry,
  resolveSkillRegistryPath,
  readSkillRegistry,
  writeSkillRegistry,
} from '../skill-registry-io.js';
import type { SkillRegistry } from '../schemas/index.js';

describe('skill-registry-io', () => {
  let tmpBase = '';

  afterEach(() => {
    if (tmpBase && existsSync(tmpBase)) {
      rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('resolveSkillRegistryPath는 .ai-ops/skills-manifest.json을 가리킨다', () => {
    expect(resolveSkillRegistryPath('/tmp/demo')).toBe('/tmp/demo/.ai-ops/skills-manifest.json');
  });

  it('serialize/parse round-trip', () => {
    const registry: SkillRegistry = {
      skills: [
        {
          id: 'skill-load-check',
          kind: 'task' as const,
          tools: ['codex'],
          installed_paths: ['.agents/skills/skill-load-check'],
          sourceHash: 'abc123',
        },
      ],
      cliVersion: '0.1.24',
      generatedAt: '2026-03-13T00:00:00Z',
    };

    expect(parseSkillRegistry(serializeSkillRegistry(registry))).toEqual(registry);
  });

  it('read/write works on disk', () => {
    tmpBase = mkdtempSync(join(tmpdir(), 'skill-registry-'));
    const path = resolveSkillRegistryPath(tmpBase);
    const registry: SkillRegistry = {
      skills: [],
      generatedAt: '2026-03-13T00:00:00Z',
    };

    writeSkillRegistry(path, registry);
    expect(readSkillRegistry(path)).toEqual(registry);
  });
});
