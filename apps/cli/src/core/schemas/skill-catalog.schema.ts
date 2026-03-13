import { z } from 'zod';
import { SkillKindSchema, SkillScopeSchema, SkillToolSchema } from './skill.schema.js';

const SkillIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case');
const SkillCatalogPathSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/, 'source_path must be relative kebab-case path');

export const SkillCatalogEntrySchema = z
  .object({
    id: SkillIdSchema,
    kind: SkillKindSchema,
    supported_tools: z.array(SkillToolSchema).min(1),
    install_scopes: z.array(SkillScopeSchema).min(1),
    groups: z.array(z.string().min(1)),
    included_in_presets: z.array(z.string().min(1)),
    source_path: SkillCatalogPathSchema,
  })
  .strict()
  .superRefine((entry, ctx) => {
    const expectedPrefix = entry.kind === 'reference' ? 'reference-skills/' : 'task-skills/';

    if (!entry.source_path.startsWith(expectedPrefix)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['source_path'],
        message: `source_path must start with ${expectedPrefix}`,
      });
    }
  });

export const SkillCatalogSchema = z
  .object({
    skills: z.array(SkillCatalogEntrySchema),
  })
  .strict();

export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>;
export type SkillCatalog = z.infer<typeof SkillCatalogSchema>;
