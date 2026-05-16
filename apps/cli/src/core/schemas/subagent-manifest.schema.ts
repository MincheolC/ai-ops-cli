import { z } from 'zod';
import { InstalledSubagentSchema } from './subagent.schema.js';

export const SubagentManifestSchema = z
  .object({
    subagents: z.array(InstalledSubagentSchema),
    cliVersion: z.string().optional(),
    generatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SubagentManifest = z.infer<typeof SubagentManifestSchema>;
