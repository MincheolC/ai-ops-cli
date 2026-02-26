import { z } from 'zod';

export const PresetSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/)
      .min(1),
    description: z.string().min(1),
    rules: z.array(z.string().min(1)).min(1),
  })
  .strict();

export type Preset = z.infer<typeof PresetSchema>;
