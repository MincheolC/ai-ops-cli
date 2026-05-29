import { z } from 'zod';
import { INTEGRATION_COMPONENT_TYPE, IntegrationIdSchema } from './integration.schema.js';
import { SkillToolSchema } from './skill.schema.js';

const ComponentIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'component id must be kebab-case');

export const IntegrationCatalogSkillComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.SKILL),
    id: ComponentIdSchema,
    tools: z.array(SkillToolSchema).min(1),
  })
  .strict();

export const IntegrationCatalogSubagentComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.SUBAGENT),
    id: ComponentIdSchema,
    tools: z.array(SkillToolSchema).min(1),
  })
  .strict();

export const IntegrationCatalogCodexHookComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.CODEX_HOOK),
    id: IntegrationIdSchema,
  })
  .strict();

export const IntegrationCatalogReceiptConfigComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG),
    id: ComponentIdSchema,
    storage_path: z.string().min(1),
  })
  .strict();

export const IntegrationCatalogComponentSchema = z.union([
  IntegrationCatalogSkillComponentSchema,
  IntegrationCatalogSubagentComponentSchema,
  IntegrationCatalogCodexHookComponentSchema,
  IntegrationCatalogReceiptConfigComponentSchema,
]);

export const IntegrationCatalogEntrySchema = z
  .object({
    id: IntegrationIdSchema,
    description: z.string().min(1),
    components: z.array(IntegrationCatalogComponentSchema).min(1),
  })
  .strict();

export const IntegrationCatalogSchema = z
  .object({
    integrations: z.array(IntegrationCatalogEntrySchema),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    const seen = new Set<string>();
    for (const [index, entry] of catalog.integrations.entries()) {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['integrations', index, 'id'],
          message: `duplicate integration id: ${entry.id}`,
        });
      }
      seen.add(entry.id);
    }
  });

export type IntegrationCatalogEntry = z.infer<typeof IntegrationCatalogEntrySchema>;
export type IntegrationCatalogComponent = z.infer<typeof IntegrationCatalogComponentSchema>;
export type IntegrationCatalog = z.infer<typeof IntegrationCatalogSchema>;
