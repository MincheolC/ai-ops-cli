import { z } from 'zod';
import { INTEGRATION_COMPONENT_TYPE, IntegrationComponentSchema, IntegrationIdSchema } from './integration.schema.js';
import { IntegrationCatalogComponentSchema } from './integration-catalog.schema.js';
import { ProjectLayerDocumentStatusSchema } from './project-layer.schema.js';
import { SkillKindSchema, SkillToolSchema } from './skill.schema.js';
import { SubagentIdSchema } from './subagent.schema.js';

const nullableString = z.string().nullable();

export const StudioProjectStateSchema = z.union([
  z.literal('ready'),
  z.literal('uninitialized'),
  z.literal('degraded'),
]);

export const StudioProjectDocumentProvenanceSchema = z.union([
  z.literal('ai-ops-managed'),
  z.literal('project-owned'),
  z.literal('pack-document'),
  z.literal('context-only'),
]);

export const StudioRuntimeFileStateSchema = z
  .object({
    path: z.string().min(1),
    exists: z.boolean(),
  })
  .strict();

export const StudioSourceStateSchema = z
  .object({
    path: z.string().min(1),
    exists: z.boolean(),
    parsed: z.boolean(),
    generatedAt: nullableString,
    error: nullableString,
  })
  .strict();

export const StudioProjectIssueSchema = z
  .object({
    level: z.union([z.literal('error'), z.literal('warning')]),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const StudioProjectDocumentSchema = z
  .object({
    path: z.string().min(1),
    status: ProjectLayerDocumentStatusSchema,
    layer: z.string().min(1),
    owner: z.string().min(1),
    read_when: z.array(z.string().min(1)),
    update_when: z.array(z.string().min(1)),
    indexedContentHash: z.string().min(1),
    currentContentHash: nullableString,
    contentHashMatches: z.boolean().nullable(),
    provenance: StudioProjectDocumentProvenanceSchema,
    content: nullableString,
    trustWarning: nullableString,
    readError: nullableString,
  })
  .strict();

export const StudioProjectSnapshotSchema = z
  .object({
    root: z.string().min(1),
    state: StudioProjectStateSchema,
    files: z
      .object({
        manifest: StudioSourceStateSchema,
        contextIndex: StudioSourceStateSchema,
        docsStatus: StudioSourceStateSchema,
      })
      .strict(),
    audit: z
      .object({
        currentSourceHash: nullableString,
        hasErrors: z.boolean(),
        hasWarnings: z.boolean(),
        issues: z.array(StudioProjectIssueSchema),
      })
      .strict(),
    documents: z.array(StudioProjectDocumentSchema),
  })
  .strict();

export const StudioIntegrationComponentStatusSchema = z
  .object({
    type: z.union([
      z.literal(INTEGRATION_COMPONENT_TYPE.SKILL),
      z.literal(INTEGRATION_COMPONENT_TYPE.CODEX_HOOK),
      z.literal(INTEGRATION_COMPONENT_TYPE.RECEIPT_CONFIG),
    ]),
    id: z.string().min(1),
    installed: z.boolean(),
    owned: z.boolean().nullable(),
    catalog: IntegrationCatalogComponentSchema,
    installedComponent: IntegrationComponentSchema.nullable(),
  })
  .strict();

export const StudioIntegrationSnapshotSchema = z
  .object({
    id: IntegrationIdSchema,
    description: z.string().min(1),
    installed: z.boolean(),
    installedAt: nullableString,
    updatedAt: nullableString,
    components: z.array(StudioIntegrationComponentStatusSchema),
  })
  .strict();

export const StudioInstalledPathStateSchema = z
  .object({
    path: z.string().min(1),
    exists: z.boolean(),
  })
  .strict();

export const StudioSkillSnapshotSchema = z
  .object({
    id: z.string().min(1),
    kind: SkillKindSchema,
    description: z.string().min(1),
    supported_tools: z.array(SkillToolSchema),
    groups: z.array(z.string().min(1)),
    installed: z.boolean(),
    installedTools: z.array(SkillToolSchema),
    installedPaths: z.array(StudioInstalledPathStateSchema),
    sourceHash: nullableString,
  })
  .strict();

export const StudioSubagentSnapshotSchema = z
  .object({
    id: SubagentIdSchema,
    description: z.string().min(1),
    supported_tools: z.array(SkillToolSchema),
    installed: z.boolean(),
    installedTools: z.array(SkillToolSchema),
    installedPaths: z.array(StudioInstalledPathStateSchema),
    sourceHash: nullableString,
  })
  .strict();

export const StudioHookSnapshotSchema = z
  .object({
    id: z.string().min(1),
    statusMessage: z.string().min(1),
    hooksPath: nullableString,
    installed: z.boolean(),
    error: nullableString,
  })
  .strict();

export const StudioRuntimeSnapshotSchema = z
  .object({
    available: z.boolean(),
    unavailableReason: nullableString,
    userBasePath: nullableString,
    codexHomePath: nullableString,
    manifests: z
      .object({
        integrations: StudioSourceStateSchema,
        skills: StudioSourceStateSchema,
        subagents: StudioSourceStateSchema,
        hooks: StudioSourceStateSchema,
      })
      .strict(),
    integrations: z.array(StudioIntegrationSnapshotSchema),
    skills: z.array(StudioSkillSnapshotSchema),
    subagents: z.array(StudioSubagentSnapshotSchema),
    hooks: z.array(StudioHookSnapshotSchema),
  })
  .strict();

export const StudioSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('ai-ops-studio-snapshot'),
    generatedAt: z.string().datetime({ offset: true }),
    cliVersion: z.string().min(1),
    project: StudioProjectSnapshotSchema,
    runtime: StudioRuntimeSnapshotSchema,
  })
  .strict();

export type StudioProjectState = z.infer<typeof StudioProjectStateSchema>;
export type StudioProjectDocumentProvenance = z.infer<typeof StudioProjectDocumentProvenanceSchema>;
export type StudioSourceState = z.infer<typeof StudioSourceStateSchema>;
export type StudioProjectIssue = z.infer<typeof StudioProjectIssueSchema>;
export type StudioProjectDocument = z.infer<typeof StudioProjectDocumentSchema>;
export type StudioProjectSnapshot = z.infer<typeof StudioProjectSnapshotSchema>;
export type StudioIntegrationComponentStatus = z.infer<typeof StudioIntegrationComponentStatusSchema>;
export type StudioIntegrationSnapshot = z.infer<typeof StudioIntegrationSnapshotSchema>;
export type StudioInstalledPathState = z.infer<typeof StudioInstalledPathStateSchema>;
export type StudioSkillSnapshot = z.infer<typeof StudioSkillSnapshotSchema>;
export type StudioSubagentSnapshot = z.infer<typeof StudioSubagentSnapshotSchema>;
export type StudioHookSnapshot = z.infer<typeof StudioHookSnapshotSchema>;
export type StudioRuntimeSnapshot = z.infer<typeof StudioRuntimeSnapshotSchema>;
export type StudioSnapshot = z.infer<typeof StudioSnapshotSchema>;
