import { z } from 'zod';

const PackIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case');
const PackSourcePathSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/, 'source_path must be relative kebab-case path');

export const PackCatalogEntrySchema = z
  .object({
    id: PackIdSchema,
    source_path: PackSourcePathSchema,
  })
  .strict();

export const PackCatalogSchema = z
  .object({
    packs: z.array(PackCatalogEntrySchema),
  })
  .strict();

export type PackCatalogEntry = z.infer<typeof PackCatalogEntrySchema>;
export type PackCatalog = z.infer<typeof PackCatalogSchema>;
