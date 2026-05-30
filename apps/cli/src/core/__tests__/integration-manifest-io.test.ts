import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { INTEGRATION_COMPONENT_TYPE, INTEGRATION_ID } from '../schemas/index.js';
import {
  findInstalledIntegration,
  readIntegrationManifest,
  resolveIntegrationManifestPath,
  writeUserIntegrationState,
} from '../../features/integrations/manifest-io.js';

describe('integration manifest IO', () => {
  it('writes, upserts, and removes user-local integration ownership state', () => {
    const dir = mkdtempSync(join(tmpdir(), 'integration-manifest-'));
    try {
      const manifestPath = resolveIntegrationManifestPath(dir);
      writeUserIntegrationState({
        manifestPath,
        cliVersion: '1.2.3',
        nextIntegration: {
          id: INTEGRATION_ID.PC,
          components: [
            {
              type: INTEGRATION_COMPONENT_TYPE.SKILL,
              id: 'pc',
              tools: ['codex'],
              owned: true,
            },
            {
              type: INTEGRATION_COMPONENT_TYPE.CODEX_HOOK,
              id: INTEGRATION_ID.PC,
              command: 'ai-ops integration hook post-tool-use --workflows pc',
              owned: true,
            },
            {
              type: INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
              id: 'personal-project-contexts',
              storagePath: '~/.personal-project-contexts',
              owned: false,
            },
          ],
          installedAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      });

      const manifest = readIntegrationManifest(manifestPath);
      expect(manifest?.kind).toBe('ai-ops-integrations-manifest');
      expect(findInstalledIntegration(manifest?.integrations ?? [], INTEGRATION_ID.PC)?.components).toHaveLength(3);

      writeUserIntegrationState({
        manifestPath,
        cliVersion: '1.2.3',
        removeIntegrationId: INTEGRATION_ID.PC,
      });

      expect(readIntegrationManifest(manifestPath)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignores removed integration entries and cleans them on the next write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'integration-manifest-'));
    try {
      const manifestPath = resolveIntegrationManifestPath(dir);
      mkdirSync(join(dir, '.ai-ops'), { recursive: true });
      writeFileSync(
        manifestPath,
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: 'ai-ops-integrations-manifest',
            integrations: [
              {
                id: 'context-promotion',
                components: [],
                installedAt: '2026-05-19T00:00:00.000Z',
                updatedAt: '2026-05-19T00:00:00.000Z',
              },
            ],
            cliVersion: '1.2.3',
            generatedAt: '2026-05-19T00:00:00.000Z',
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      expect(readIntegrationManifest(manifestPath)?.integrations).toEqual([]);

      writeUserIntegrationState({
        manifestPath,
        cliVersion: '1.2.3',
        nextIntegration: {
          id: INTEGRATION_ID.PC,
          components: [
            {
              type: INTEGRATION_COMPONENT_TYPE.SKILL,
              id: 'pc',
              tools: ['codex'],
              owned: true,
            },
          ],
          installedAt: '2026-05-19T00:00:00.000Z',
          updatedAt: '2026-05-19T00:00:00.000Z',
        },
      });

      const raw = readFileSync(manifestPath, 'utf-8');
      expect(raw).toContain('"id": "pc"');
      expect(raw).not.toContain('context-promotion');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
