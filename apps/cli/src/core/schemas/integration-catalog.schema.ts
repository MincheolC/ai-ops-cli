import { z } from 'zod';
import { INTEGRATION_COMPONENT_TYPE, IntegrationIdSchema } from './integration.schema.js';

const ComponentIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'component id must be kebab-case');

export const IntegrationCatalogSkillComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.SKILL),
    id: ComponentIdSchema,
    tools: z.array(z.literal('codex')).min(1),
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
  IntegrationCatalogCodexHookComponentSchema,
  IntegrationCatalogReceiptConfigComponentSchema,
]);

export const IntegrationCatalogEntrySchema = z
  .object({
    id: IntegrationIdSchema,
    description: z.string().min(1),
    components: z.array(IntegrationCatalogComponentSchema).min(1),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const hasSkill = entry.components.some((component) => component.type === INTEGRATION_COMPONENT_TYPE.SKILL);
    const hasCodexHook = entry.components.some((component) => component.type === INTEGRATION_COMPONENT_TYPE.CODEX_HOOK);
    const hasReceiptConfig = entry.components.some(
      (component) => component.type === INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG,
    );

    if (!hasSkill) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components'],
        message: `integration must declare a skill component: ${entry.id}`,
      });
    }
    if (!hasCodexHook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components'],
        message: `integration must declare a codex-hook component: ${entry.id}`,
      });
    }
    if (!hasReceiptConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['components'],
        message: `integration must declare a receipt-config component: ${entry.id}`,
      });
    }
  });

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
