import { z } from 'zod';

export const SKILL_KIND = {
  REFERENCE: 'reference',
  TASK: 'task',
} as const;

export const SKILL_TOOL = {
  CLAUDE_CODE: 'claude-code',
  CODEX: 'codex',
  GEMINI: 'gemini',
} as const;

export const SkillKindSchema = z.union([z.literal(SKILL_KIND.REFERENCE), z.literal(SKILL_KIND.TASK)]);
export const SkillToolSchema = z.union([
  z.literal(SKILL_TOOL.CLAUDE_CODE),
  z.literal(SKILL_TOOL.CODEX),
  z.literal(SKILL_TOOL.GEMINI),
]);

export const SkillFileSchema = z
  .object({
    path: z.string().min(1),
    content: z.string(),
  })
  .strict();

export const SkillFrontmatterSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'name must be kebab-case'),
    description: z.string().min(1),
  })
  .passthrough();

export type SkillFile = z.infer<typeof SkillFileSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
export type Skill = {
  id: string;
  kind: z.infer<typeof SkillKindSchema>;
  description: string;
  supported_tools: z.infer<typeof SkillToolSchema>[];
  groups: string[];
  included_in_presets: string[];
  directory: string;
  files: SkillFile[];
};

export const InstalledSkillSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
    kind: SkillKindSchema,
    tools: z.array(SkillToolSchema).min(1),
    installed_paths: z.array(z.string().min(1)).min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
  })
  .strip();

export type InstalledSkill = z.infer<typeof InstalledSkillSchema>;
