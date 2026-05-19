import { join } from 'node:path';
import { computeInstalledSkillHash } from './source-hash.js';
import type { Skill, InstalledSkill, ToolId } from './schemas/index.js';

const AGENT_SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';

type SkillPackageFile = {
  relativePath: string;
  content: string;
};

export type SkillPackage = {
  skillId: string;
  rootDir: string;
  files: SkillPackageFile[];
};

const buildRootDirs = (skillId: string, toolIds: readonly ToolId[]): string[] => {
  const dirs: string[] = [];
  if (toolIds.some((toolId) => toolId === 'codex' || toolId === 'gemini')) {
    dirs.push(join(AGENT_SKILLS_DIR, skillId));
  }
  if (toolIds.includes('claude-code')) {
    dirs.push(join(CLAUDE_SKILLS_DIR, skillId));
  }
  return dirs;
};

const normalizeSelectedTools = (skill: Skill, requestedTools: readonly ToolId[]): ToolId[] => {
  const supportedToolSet = new Set(skill.supported_tools);
  return requestedTools.filter((toolId) => supportedToolSet.has(toolId));
};

export const buildSkillInstallPlan = (params: {
  skill: Skill;
  requestedTools: readonly ToolId[];
}): { packages: SkillPackage[]; installedSkill: InstalledSkill } => {
  const selectedTools = normalizeSelectedTools(params.skill, params.requestedTools);
  if (selectedTools.length === 0) {
    throw new Error(`Skill ${params.skill.id} does not support the requested tools`);
  }

  const rootDirs = buildRootDirs(params.skill.id, selectedTools);
  const skillHash = computeInstalledSkillHash({
    kind: params.skill.kind,
    description: params.skill.description,
    tools: selectedTools,
    files: params.skill.files.map((file) => `${file.path}:${file.content}`),
  });

  const packages = rootDirs.map((rootDir) => {
    const files: SkillPackageFile[] = params.skill.files.map((file) => ({
      relativePath: join(rootDir, file.path),
      content: file.content,
    }));

    return {
      skillId: params.skill.id,
      rootDir,
      files,
    };
  });

  return {
    packages,
    installedSkill: {
      id: params.skill.id,
      kind: params.skill.kind,
      tools: selectedTools,
      installed_paths: rootDirs,
      sourceHash: skillHash,
    },
  };
};
