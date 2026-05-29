import { z } from 'zod';
import { SkillToolSchema } from './skill.schema.js';

export const INTEGRATION_ID = {
  CODE_REVIEW_GATE: 'code-review-gate',
  CONTEXT_PROMOTION: 'context-promotion',
  PC: 'pc',
} as const;

export const INTEGRATION_COMPONENT_TYPE = {
  SKILL: 'skill',
  SUBAGENT: 'subagent',
  CODEX_HOOK: 'codex-hook',
  RECEIPT_CONFIG: 'receipt-config',
} as const;

export const IntegrationIdSchema = z.union([
  z.literal(INTEGRATION_ID.CODE_REVIEW_GATE),
  z.literal(INTEGRATION_ID.CONTEXT_PROMOTION),
  z.literal(INTEGRATION_ID.PC),
]);

const ComponentIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

const IntegrationSkillComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.SKILL),
    id: ComponentIdSchema,
    tools: z.array(SkillToolSchema).min(1),
    owned: z.boolean(),
  })
  .strict();

const IntegrationSubagentComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.SUBAGENT),
    id: ComponentIdSchema,
    tools: z.array(SkillToolSchema).min(1),
    owned: z.boolean(),
  })
  .strict();

const IntegrationCodexHookComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.CODEX_HOOK),
    id: IntegrationIdSchema,
    command: z.string().min(1),
    commandWindows: z.string().min(1).optional(),
    owned: z.boolean(),
  })
  .strict();

const IntegrationReceiptConfigComponentSchema = z
  .object({
    type: z.literal(INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG),
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    storagePath: z.string().min(1),
    owned: z.boolean(),
  })
  .strict();

export const IntegrationComponentSchema = z.union([
  IntegrationSkillComponentSchema,
  IntegrationSubagentComponentSchema,
  IntegrationCodexHookComponentSchema,
  IntegrationReceiptConfigComponentSchema,
]);

export const InstalledIntegrationSchema = z
  .object({
    id: IntegrationIdSchema,
    components: z.array(IntegrationComponentSchema),
    installedAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

export const IntegrationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('ai-ops-integrations-manifest'),
    integrations: z.array(InstalledIntegrationSchema),
    cliVersion: z.string().min(1),
    generatedAt: z.string().min(1),
  })
  .strict();

export type IntegrationId = z.infer<typeof IntegrationIdSchema>;
export type IntegrationComponent = z.infer<typeof IntegrationComponentSchema>;
export type InstalledIntegration = z.infer<typeof InstalledIntegrationSchema>;
export type IntegrationManifest = z.infer<typeof IntegrationManifestSchema>;
