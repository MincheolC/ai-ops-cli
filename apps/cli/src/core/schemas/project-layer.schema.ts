import { z } from 'zod';

export const ProjectLayerToolSchema = z.enum(['claude-code', 'codex', 'gemini']);

export const ProjectLayerDocumentStatusSchema = z.enum(['Active', 'Reserved', 'Draft', 'Archived']);

const ShortHashSchema = z.string().regex(/^[a-f0-9]{6}$/, 'hash must be 6 lowercase hex chars');

export const isSafeProjectLayerPath = (value: string): boolean => {
  if (value.length === 0) return false;
  if (value.includes('\0')) return false;
  if (value.includes('\\')) return false;
  if (value.startsWith('/')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;

  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
};

const ProjectLayerPathSchema = z
  .string()
  .min(1)
  .refine(isSafeProjectLayerPath, 'path must be a safe project-relative path');

export const ProjectLayerFrontmatterSchema = z
  .object({
    status: ProjectLayerDocumentStatusSchema,
    layer: z.string().min(1),
    owner: z.string().min(1),
    read_when: z.array(z.string().min(1)).min(1),
    update_when: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const ProjectLayerManagedFileSchema = z
  .object({
    path: ProjectLayerPathSchema,
    sourceHash: ShortHashSchema,
  })
  .strict();

export const ProjectLayerProjectFileSchema = z
  .object({
    path: ProjectLayerPathSchema,
    templateHash: ShortHashSchema,
    created: z.boolean(),
  })
  .strict();

export const ProjectLayerManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('project-operating-layer'),
    tools: z.array(ProjectLayerToolSchema).min(1),
    managed_files: z.array(ProjectLayerManagedFileSchema),
    project_files: z.array(ProjectLayerProjectFileSchema),
    settings: z.record(z.unknown()),
    sourceHash: ShortHashSchema,
    cliVersion: z.string().min(1),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const ProjectLayerContextDocumentSchema = ProjectLayerFrontmatterSchema.extend({
  path: ProjectLayerPathSchema,
  contentHash: ShortHashSchema,
}).strict();

export const ProjectLayerContextIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    kind: z.literal('context-layer-index'),
    documents: z.array(ProjectLayerContextDocumentSchema),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ProjectLayerTool = z.infer<typeof ProjectLayerToolSchema>;
export type ProjectLayerDocumentStatus = z.infer<typeof ProjectLayerDocumentStatusSchema>;
export type ProjectLayerFrontmatter = z.infer<typeof ProjectLayerFrontmatterSchema>;
export type ProjectLayerManagedFile = z.infer<typeof ProjectLayerManagedFileSchema>;
export type ProjectLayerProjectFile = z.infer<typeof ProjectLayerProjectFileSchema>;
export type ProjectLayerManifest = z.infer<typeof ProjectLayerManifestSchema>;
export type ProjectLayerContextDocument = z.infer<typeof ProjectLayerContextDocumentSchema>;
export type ProjectLayerContextIndex = z.infer<typeof ProjectLayerContextIndexSchema>;
