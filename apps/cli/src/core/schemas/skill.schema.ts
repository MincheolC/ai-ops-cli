import { z } from 'zod';

export const SKILL_KIND = {
  REFERENCE: 'reference',
  TASK: 'task',
} as const;

export const SKILL_SCOPE = {
  PROJECT: 'project',
  USER: 'user',
} as const;

export const SKILL_TOOL = {
  CLAUDE_CODE: 'claude-code',
  CODEX: 'codex',
  GEMINI: 'gemini',
} as const;

const SkillKindSchema = z.union([z.literal(SKILL_KIND.REFERENCE), z.literal(SKILL_KIND.TASK)]);
const SkillScopeSchema = z.union([z.literal(SKILL_SCOPE.PROJECT), z.literal(SKILL_SCOPE.USER)]);
const SkillToolSchema = z.union([
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

export const SkillSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
    kind: SkillKindSchema,
    description: z.string().min(1),
    supported_tools: z.array(SkillToolSchema).min(1),
    allow_implicit_invocation: z.boolean().default(true),
    install_scopes: z.array(SkillScopeSchema).min(1),
    instructions: z.string().min(1).optional(),
    source_rules: z.array(z.string().min(1)).optional(),
    references: z.array(SkillFileSchema).optional(),
    assets: z.array(SkillFileSchema).optional(),
    scripts: z.array(SkillFileSchema).optional(),
  })
  .strict();

export type SkillFile = z.infer<typeof SkillFileSchema>;
export type Skill = z.infer<typeof SkillSchema>;

export const InstalledSkillSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case'),
    kind: SkillKindSchema,
    tools: z.array(SkillToolSchema).min(1),
    scope: SkillScopeSchema,
    installed_paths: z.array(z.string().min(1)).min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
    source_rules: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type InstalledSkill = z.infer<typeof InstalledSkillSchema>;
