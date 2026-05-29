import { describe, expect, it } from 'vitest';
import { IntegrationCatalogSchema } from '../integration-catalog.schema.js';

describe('IntegrationCatalogSchema', () => {
  it('accepts valid integration catalog entries', () => {
    const parsed = IntegrationCatalogSchema.parse({
      integrations: [
        {
          id: 'context-promotion',
          description: 'Context promotion review integration',
          components: [
            { type: 'skill', id: 'context-promotion-review', tools: ['codex'] },
            { type: 'codex-hook', id: 'context-promotion' },
            {
              type: 'receipt-config',
              id: 'context-promotion-receipts',
              storage_path: '.ai-ops/context-promotion/projects/*/receipts-index.json',
            },
          ],
        },
        {
          id: 'pc',
          description: 'Personal context handoff integration',
          components: [
            { type: 'skill', id: 'pc', tools: ['codex'] },
            { type: 'codex-hook', id: 'pc' },
            { type: 'receipt-config', id: 'personal-project-contexts', storage_path: '~/.personal-project-contexts' },
          ],
        },
      ],
    });

    expect(parsed.integrations).toHaveLength(2);
  });

  it('rejects unknown integration ids and duplicate ids', () => {
    expect(() =>
      IntegrationCatalogSchema.parse({
        integrations: [
          {
            id: 'unknown',
            description: 'Unknown integration',
            components: [
              { type: 'skill', id: 'unknown', tools: ['codex'] },
              { type: 'codex-hook', id: 'unknown' },
              { type: 'receipt-config', id: 'unknown-receipts', storage_path: '~/.unknown' },
            ],
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      IntegrationCatalogSchema.parse({
        integrations: [
          {
            id: 'pc',
            description: 'Personal context handoff integration',
            components: [
              { type: 'skill', id: 'pc', tools: ['codex'] },
              { type: 'codex-hook', id: 'pc' },
              { type: 'receipt-config', id: 'personal-project-contexts', storage_path: '~/.personal-project-contexts' },
            ],
          },
          {
            id: 'pc',
            description: 'Duplicate personal context handoff integration',
            components: [
              { type: 'skill', id: 'pc', tools: ['codex'] },
              { type: 'codex-hook', id: 'pc' },
              { type: 'receipt-config', id: 'personal-project-contexts', storage_path: '~/.personal-project-contexts' },
            ],
          },
        ],
      }),
    ).toThrow('duplicate integration id: pc');
  });

  it('rejects catalog entries that omit receipt/config component metadata', () => {
    expect(() =>
      IntegrationCatalogSchema.parse({
        integrations: [
          {
            id: 'pc',
            description: 'Personal context handoff integration',
            components: [
              { type: 'skill', id: 'pc', tools: ['codex'] },
              { type: 'codex-hook', id: 'pc' },
            ],
          },
        ],
      }),
    ).toThrow('integration must declare a receipt-config component: pc');
  });
});
