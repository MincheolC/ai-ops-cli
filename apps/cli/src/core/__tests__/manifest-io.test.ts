import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseManifest,
  serializeManifest,
  resolveManifestPath,
  readManifest,
  writeManifest,
  MANIFEST_FILENAME,
} from '../manifest-io.js';
import type { Manifest } from '../schemas/index.js';

const VALID_MANIFEST: Manifest = {
  tools: ['claude-code'],
  scope: 'project',
  preset: 'web',
  installed_rules: ['typescript', 'react-typescript'],
  sourceHash: 'a1b2c3',
  generatedAt: '2026-02-27T00:00:00.000Z',
};

describe('parseManifest', () => {
  it('parses valid JSON into Manifest', () => {
    const result = parseManifest(JSON.stringify(VALID_MANIFEST));
    expect(result).toEqual(VALID_MANIFEST);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseManifest('not json')).toThrow();
  });

  it('throws on Zod validation failure', () => {
    const bad = { ...VALID_MANIFEST, sourceHash: 'toolong' };
    expect(() => parseManifest(JSON.stringify(bad))).toThrow();
  });
});

describe('serializeManifest', () => {
  it('produces pretty-printed JSON with trailing newline', () => {
    const result = serializeManifest(VALID_MANIFEST);
    expect(result).toContain('\n  ');
    expect(result.endsWith('\n')).toBe(true);
  });
});

describe('roundtrip', () => {
  it('serialize → parse returns equivalent object', () => {
    const result = parseManifest(serializeManifest(VALID_MANIFEST));
    expect(result).toEqual(VALID_MANIFEST);
  });
});

describe('resolveManifestPath', () => {
  it('joins basePath with MANIFEST_FILENAME', () => {
    expect(resolveManifestPath('/some/path')).toBe(`/some/path/${MANIFEST_FILENAME}`);
  });
});

describe('readManifest / writeManifest', () => {
  let tmpDir: string;

  const setup = () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'manifest-io-test-'));
    return () => rmSync(tmpDir, { recursive: true, force: true });
  };

  it('returns null when file does not exist', () => {
    const cleanup = setup();
    try {
      expect(readManifest(join(tmpDir, 'nonexistent.json'))).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('reads a valid manifest file', () => {
    const cleanup = setup();
    try {
      const path = resolveManifestPath(tmpDir);
      writeManifest(path, VALID_MANIFEST);
      expect(readManifest(path)).toEqual(VALID_MANIFEST);
    } finally {
      cleanup();
    }
  });

  it('write → read roundtrip', () => {
    const cleanup = setup();
    try {
      const path = resolveManifestPath(tmpDir);
      writeManifest(path, VALID_MANIFEST);
      const result = readManifest(path);
      expect(result).toEqual(VALID_MANIFEST);
    } finally {
      cleanup();
    }
  });

  it('creates intermediate directories automatically', () => {
    const cleanup = setup();
    try {
      const deepPath = join(tmpDir, 'deep', 'nested', 'dir', MANIFEST_FILENAME);
      writeManifest(deepPath, VALID_MANIFEST);
      expect(readManifest(deepPath)).toEqual(VALID_MANIFEST);
    } finally {
      cleanup();
    }
  });
});
