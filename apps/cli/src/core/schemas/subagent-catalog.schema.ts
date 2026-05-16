import { z } from 'zod';
import { SkillToolSchema } from './skill.schema.js';
import { SubagentIdSchema } from './subagent.schema.js';

const SubagentCatalogPathSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
    'source_path must be relative kebab-case path',
  );

export const SubagentCatalogEntrySchema = z
  .object({
    id: SubagentIdSchema,
    supported_tools: z.array(SkillToolSchema).min(1),
    source_path: SubagentCatalogPathSchema,
  })
  .strict();

export const SubagentCatalogSchema = z
  .object({
    subagents: z.array(SubagentCatalogEntrySchema),
  })
  .strict();

export type SubagentCatalogEntry = z.infer<typeof SubagentCatalogEntrySchema>;
export type SubagentCatalog = z.infer<typeof SubagentCatalogSchema>;
