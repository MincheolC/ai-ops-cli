import { z } from 'zod';
import { SkillToolSchema } from './skill.schema.js';
import { isSafeProjectLayerPath } from './project-layer.schema.js';
import { buildSubagentRelativePath } from '../subagent-paths.js';

export const SubagentIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id must be kebab-case');

export const SubagentMarkdownFrontmatterSchema = z
  .object({
    name: SubagentIdSchema,
    description: z.string().min(1),
  })
  .passthrough();

const TomlValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
const SubagentInstalledPathSchema = z
  .string()
  .min(1)
  .refine(isSafeProjectLayerPath, 'installed path must be safe relative path');

export const CodexSubagentFrontmatterSchema = z
  .object({
    name: SubagentIdSchema,
    description: z.string().min(1),
    skill_names: z.array(SubagentIdSchema).optional(),
  })
  .catchall(TomlValueSchema);

export type SubagentMarkdownFrontmatter = z.infer<typeof SubagentMarkdownFrontmatterSchema>;
export type CodexSubagentFrontmatter = z.infer<typeof CodexSubagentFrontmatterSchema>;

export type Subagent = {
  id: string;
  supported_tools: z.infer<typeof SkillToolSchema>[];
  source_path: string;
  directory: string;
  prompt: string;
  frontmatter: {
    claude: {
      raw: string;
      parsed: SubagentMarkdownFrontmatter;
    };
    codex: {
      raw: string;
      parsed: CodexSubagentFrontmatter;
    };
    gemini: {
      raw: string;
      parsed: SubagentMarkdownFrontmatter;
    };
  };
};

export const InstalledSubagentSchema = z
  .object({
    id: SubagentIdSchema,
    tools: z.array(SkillToolSchema).min(1),
    installed_paths: z.array(SubagentInstalledPathSchema).min(1),
    sourceHash: z.string().regex(/^[a-f0-9]{6}$/, 'sourceHash must be 6 lowercase hex chars'),
  })
  .strip()
  .superRefine((subagent, ctx) => {
    const expectedPaths = new Set(subagent.tools.map((tool) => buildSubagentRelativePath(subagent.id, tool)));
    const installedPaths = new Set(subagent.installed_paths);

    if (installedPaths.size !== subagent.installed_paths.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installed_paths'],
        message: 'installed_paths must not contain duplicates',
      });
      return;
    }

    if (installedPaths.size !== expectedPaths.size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['installed_paths'],
        message: 'installed_paths must match id and tools',
      });
      return;
    }

    for (const installedPath of installedPaths) {
      if (!expectedPaths.has(installedPath)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['installed_paths'],
          message: 'installed_paths must match id and tools',
        });
        return;
      }
    }
  });

export type InstalledSubagent = z.infer<typeof InstalledSubagentSchema>;
