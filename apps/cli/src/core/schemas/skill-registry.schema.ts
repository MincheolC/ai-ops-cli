import { z } from 'zod';
import { InstalledSkillSchema } from './skill.schema.js';

export const SkillRegistrySchema = z
  .object({
    skills: z.array(InstalledSkillSchema),
    cliVersion: z.string().optional(),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SkillRegistry = z.infer<typeof SkillRegistrySchema>;
